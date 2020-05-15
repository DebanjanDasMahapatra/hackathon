const router = require('express').Router();
const sha1 = require("sha1");
const multer = require('multer');
const fs = require('fs');
const rimraf = require('rimraf');
const archiver = require('archiver');
const path = require('path');
const uploadFile = multer({ storage: multer.memoryStorage() });

const User = require('../models/user');
const Auth = require("../middlewares/auth");
const GCS = require("../helpers/gcs");

router.get("/fetchUsers", Auth.authenticateAdmin,  (req, res) => {
  User.find({}, (err, users) => {
    if (err)
      return res.status(500).json({
        status: false,
        message: "Fetching Users Failed! Server Error..",
        error: err
      });
    return res.status(200).json({
      status: true,
      message: "Fetched successfully",
      user: users
    });
  });
});

router.post("/resetPassword", Auth.authenticateAdmin,  (req, res) => {
  User.findOneAndUpdate({username: req.body.username}, {$set: {password: sha1(req.body.password)}}, (err, updatedUser) => {
    if (err)
      return res.status(500).json({
        status: false,
        message: "Password Reset Failed! Server Error..",
        error: err
      });
    return res.status(200).json({
      status: true,
      message: `Password Reset to ${req.body.password} Success`,
      user: updatedUser
    });
  });
});

router.get("/deleteUser/:username", Auth.authenticateAdmin, (req, res) => {
  User.findOneAndRemove({username: req.params.username}, (err, deletedUser) => {
    if (err)
      return res.status(500).json({
        status: false,
        message: "Deleting User Failed! Server Error..",
        error: err
      });
    if(deletedUser) {
      let deletUser = async() => {
        const [files] = await GCS.getFiles({ prefix: req.params.username+'/' });
        let error = false;
        files.forEach(async (file) => {
          try {
            await file.delete();
          } catch(err) {
            error = true;
          }
        })
        return res.status(200).json({
          status: true,
          message: "Deleted successfully",
          user: deletedUser
        });
      }
      deletUser().catch(err => {
        return res.status(500).json({
          status: false,
          message: 'Cannot Delete User Files',
          error: err
        });
      });
    }
    else
      return res.status(500).json({
        status: false,
        message: "Deletion Failed",
        error: 'Unknown'
      });
  });
});

router.post('/setSettings', Auth.authenticateAdmin, uploadFile.single('file'), (req, res) => {
  let f = req.file == undefined;
  let o = JSON.stringify(req.body) == '{}';
  if(!f && !o)
    updateBanner(req.file.buffer, 'banner.'+req.file.originalname.split('.')[1], res, req.body);
  else if(!f)
    updateBanner(req.file.buffer, 'banner.'+req.file.originalname.split('.')[1], res);
  else if(!o)
    updateSettings(req.body, res);
  else
    return res.status(200).json({
      status: true,
      message: 'Nothing to do !!!'
    });
});

let updateSettings = (rawData, res, fromBanner = undefined) => {
  let fileData = JSON.stringify(rawData);
  const bs = GCS.file('settings.txt').createWriteStream({ resumable: false });
  bs.on('finish', () => {
    return res.status(200).json({
      status: true,
      message: 'Settings'+(fromBanner ? ' and Banner' : '')+' Updated Successfully'
    });
  }).on('error', (err) => {
    return res.status(500).json({
      status: false,
      message: 'Settings Update Error'+(fromBanner ? ', Banner Updated Successfully' : ''),
      error: err
    });
  }).end(new Buffer(fileData,'utf-8'));
}

let updateBanner = (buffer, fileName, res, settingsData = undefined) => {
  const bs = GCS.file(fileName).createWriteStream({ resumable: false });
  bs.on('finish', () => {
    if(settingsData) {
      settingsData.banner = fileName;
      updateSettings(settingsData, res, true);
    }
    else
      return res.status(200).json({
        status: true,
        message: 'Banner Updated Successfully'
      });
  }).on('error', (err) => {
    return res.status(500).json({
      status: false,
      message: 'Settings Update Error'+(fromBanner ? ', Banner Updated Successfully' : ''),
      error: err
    });
  }).end(buffer);
}

router.get('/preparedownload', Auth.authenticateAdmin, (req, res) => {
  let baseDir = path.resolve(__dirname,'..','download');
  let prepareDownload = async() => {
    const [files] = await GCS.getFiles();
    let error = [];
    if(fs.existsSync(baseDir))
      rimraf.sync(baseDir+'/');
    fs.mkdirSync(baseDir);
    files.forEach(async (file) => {
      try {
        error = [...error,file.name];
        let d = file.name.split("/");
        if(d[1].split(".").length > 1) {
          try {
            fs.mkdirSync(path.join(baseDir,d[0]));
          } catch (err) {
            error = [...error,err];
          }
          await file.download({destination: path.join(baseDir,d[0],d[1])});
        }
      } catch(err) {
        error = [...error,err];
      }
    })
    return res.status(200).json({
      status: true,
      message: "Download initiated successfully.. Come back after 3 hours and Start Zipping :)",
      data: error
    });
  }
  prepareDownload().catch(err => {
    return res.status(500).json({
      status: false,
      message: 'Cannot initiate download',
      error: err
    });
  });
});

router.get('/zipall', Auth.authenticateAdmin, (req, res) => {
  const downloadKey = generate();
  const files = fs.readdirSync(path.resolve(__dirname,'..'));
  const returnV = files.find(file => {
    return file.split(".")[1] == 'zip';
  })
  if(returnV)
    fs.unlinkSync(path.resolve(__dirname,'..',returnV));
  var output = fs.createWriteStream(downloadKey+'.zip');
  var archive = archiver('zip', {
    zlib: { level: 9 }
  });
  output.on('close', () => {
    console.log(archive.pointer() + ' total bytes, ready for downloading :)');
    return res.status(200).json({
      status: true,
      message: 'Zipping Done.',
      data: {
        key: downloadKey,
        size: Math.ceil(archive.pointer() / (1024*1024)),
        apiRes: true
      }
    });
  });
  output.on('end', () => {
    console.log('Data has been drained');
    return res.status(500).json({
      status: false,
      message: 'Cannot Download',
      error: 'err'
    });
  });
  archive.on('warning', (err) => {
    return res.status(500).json({
      status: false,
      message: 'Cannot Download',
      error: err
    });
  });
  archive.on('error', (err) => {
    return res.status(500).json({
      status: false,
      message: 'Cannot Download',
      error: err
    });
  });
  archive.pipe(output);
  archive.directory('download/', 'strokes');
  archive.finalize();
});

router.get('/downloadall/:key', (req, res) => {
  if(fs.existsSync(path.resolve(__dirname,'..',req.params.key+'.zip')))
    res.sendFile(path.resolve(__dirname,'..',req.params.key+'.zip'));
  else
    res.sendFile(path.resolve(__dirname,'..','error.png'));
});

const generate = () => {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < 15; i++ )
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  return result;
}

module.exports = router;
