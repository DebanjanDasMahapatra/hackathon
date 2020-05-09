const router = require("express").Router();
const sha1 = require("sha1");
const multer = require('multer');
const jwt = require("jsonwebtoken");
const uploadFile = multer({ storage: multer.memoryStorage() });

const User = require("../models/user");
const Auth = require("../middlewares/auth");
const GCS = require('../helpers/gcs');

router.get("/fetchUserNamesEmails", (req, res) => {
  User.find({}, {username: 1, email: 1}, (err, users) => {
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

router.post("/register", uploadFile.array('files[]',2), (req, res) => {
  const bs = GCS.file(req.body.username + '/photo.jpg').createWriteStream({ resumable: false });
  bs.on('finish', () => {
    console.log(`https://storage.googleapis.com/${GCS.name}`);
    const bs = GCS.file(req.body.username + '/idcard.jpg').createWriteStream({ resumable: false });
    bs.on('finish', () => {
      console.log(`https://storage.googleapis.com/${GCS.name}`);
      var userData = req.body;
      console.log(userData);
      userData.password = sha1(req.body.password);
      new User(userData)
        .save()
        .then(newUser => {
          if (newUser)
            return res.status(200).json({
              status: true,
              message: "Registration Successful :)",
              user: newUser
            });
          else
            return res.status(500).json({
              status: false,
              message: "Registration Failed! Try again..",
              error: "Unknown"
            });
        })
        .catch(err => {
          return res.status(500).json({
            status: false,
            message: "Registration Failed! Server Error..",
            error: err
          });
        });
    }).on('error', (err) => {
      return res.status(500).json({
        status: false,
        message: 'ID Card Upload Error',
        error: err
      });
    }).end(req.files[1].buffer);
  }).on('error', (err) => {
    return res.status(500).json({
      status: false,
      message: 'Photo Upload Error',
      error: err
    });
  }).end(req.files[0].buffer);
});

router.post("/login", (req, res) => {
  User.findOne({ username: req.body.username }, (err, newUser) => {
    if (err)
      return res.status(500).json({
        status: false,
        message: "Login Failed! Server Error..",
        error: err
      });
    if (newUser) {
      if (newUser.password === sha1(req.body.password)) {
        jwt.sign(
          newUser.toJSON(),
          process.env.SECRET,
          { expiresIn: "1h" },
          (err, token) => {
            if (err)
              return res.status(500).json({
                status: false,
                message: "Problem signing in"
              });
            return res.status(200).json({
              status: true,
              message: "Logged in successfully",
              token: token,
              user: newUser
            });
          }
        );
      } else
        return res.status(401).json({
          status: false,
          message: "Incorrect Password !!!"
        });
    } else
      return res.status(401).json({
        status: false,
        message: "User Not Found :/"
      });
  });
});

router.post('/submit/:action', Auth.authenticateAll, uploadFile.single('file'), (req, res) => {
  if(req.params.action != 'delete' && req.file.originalname.split(".")[1] !== 'zip')
    return res.status(500).json({
      status: false,
      message: "Only .zip file is allowed for Submission"
    });
    if(req.params.action === 'new')
      uploadFileAWS(req.user._id,req.user.username,req.file.buffer,res,false);
    else if(req.params.action === 'edit')
      uploadFileAWS(req.user._id,req.user.username,req.file.buffer,res,true);
    else {
      let deleteFile = async() => {
        await GCS.file(req.user.username + '/submission.zip').delete();
        console.log(` deleted.`);
        updateDatabase(req.user._id, res, true);
      }
      deleteFile().catch(err => {
        return res.status(500).json({
          status: false,
          message: 'Cannot Delete Submission',
          error: err
        });
      });
    }
});

let uploadFileAWS = (userid, username, fileBuffer, res, editing) => {
  const bs = GCS.file(username + '/submission.zip').createWriteStream({ resumable: false });
  bs.on('finish', () => {
    console.log(`https://storage.googleapis.com/${GCS.name}`);
    if(editing)
      return res.status(200).json({
        status: true,
        message: 'Updated Submission Saved Successfully'
      });
    else
      updateDatabase(userid, res, false);
  }).on('error', (err) => {
    return res.status(500).json({
      status: false,
      message: 'Submission Upload Error',
      error: err
    });
  }).end(fileBuffer);
}

let updateDatabase = (userid, res, deleting) => {
  User.findOneAndUpdate({_id: userid}, {$set: {uploaded: !deleting}}, (err, updatedUser) => {
    if(err)
      return res.status(500).json({
        status: false,
        message: 'Submission Changing Error',
        error: err
      });
    else if(updatedUser)
    return res.status(200).json({
      status: true,
      message: `Submission ${deleting ? 'Deleted' : 'Saved'} Successfully`
    });
    else
      return res.status(500).json({
        status: false,
        message: 'Submission Changing Error',
        error: 'Unknown'
      });
  });
}

module.exports = router;
