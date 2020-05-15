const router = require("express").Router();
const sha1 = require("sha1");
const multer = require('multer');
const jwt = require("jsonwebtoken");
const uploadFile = multer({ storage: multer.memoryStorage() });

const User = require("../models/user");
const Auth = require("../middlewares/auth");
const GCS = require('../helpers/gcs');

const submitImageNames = ["processing1","processing2","paintingWithArtist","finalPainting"];

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

router.post("/changePassword", Auth.authenticateUser,  (req, res) => {
  User.findOneAndUpdate({username: req.user.username}, {$set: {password: sha1(req.body.password)}}, (err, updatedUser) => {
    if (err)
      return res.status(500).json({
        status: false,
        message: "Password Change Failed! Server Error..",
        error: err
      });
    return res.status(200).json({
      status: true,
      message: `Password Change Success`,
      user: updatedUser
    });
  });
});

router.post("/register", uploadFile.array('files[]',2), (req, res) => {
return res.status(200).json({
  status: true,
  message: "Registration is Closed :/",
  user: null
});
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

router.post('/submitnew/:seq/:action', Auth.authenticateAll, uploadFile.single('file'), (req, res) => {
  if(req.params.action === 'new')
    uploadFileGCSNew(req.user._id, req.user.username, req.params.seq, req.file.buffer, res, false);
  else if(req.params.action === 'edit')
    uploadFileGCSNew(req.user._id, req.user.username, req.params.seq, req.file.buffer, res, true);
  else {
    let deleteFile = async() => {
      await GCS.file(req.user.username + `/${submitImageNames[req.params.seq-1]}.jpg`).delete();
      console.log(` deleted.`);
      updateDatabaseNew(req.user._id, req.params.seq, res, true);
    }
    deleteFile().catch(err => {
      return res.status(500).json({
        status: false,
        message: `Cannot Delete Image ${req.params.seq}`,
        error: err
      });
    });
  }
});

let uploadFileGCSNew = (userid, username, ino, fileBuffer, res, editing) => {
  const bs = GCS.file(username + `/${submitImageNames[ino-1]}.jpg`).createWriteStream({ resumable: false });
  bs.on('finish', () => {
    console.log(`https://storage.googleapis.com/${GCS.name}`);
    if(editing)
      return res.status(200).json({
        status: true,
        message: `Updated Image ${ino} Saved Successfully`
      });
    else
      updateDatabaseNew(userid, ino, res, false);
  }).on('error', (err) => {
    return res.status(500).json({
      status: false,
      message: `Image ${ino} Upload Error`,
      error: err
    });
  }).end(fileBuffer);
}

let updateDatabaseNew = (userid, ino, res, deleting) => {
  User.findById(userid, (err, currentUser) => {
    if(err)
      return res.status(500).json({
        status: false,
        message: `Image ${ino} Changing Error`,
        error: err
      });
    else if(currentUser) {
      currentUser.submissions[ino-1] = (deleting ? "" : `${submitImageNames[ino-1]}`);;
      currentUser.markModified('submissions');
      currentUser.save().then(modifiedUser => {
        return res.status(200).json({
          status: true,
          message: `Image ${ino} ${deleting ? 'Deleted' : 'Saved'} Successfully`,
          data: modifiedUser
        });
      }).catch(err2 => {
        return res.status(500).json({
          status: false,
          message: `Image ${ino} Changing Error`,
          error: err2
        });
      })
    }
    else
      return res.status(500).json({
        status: false,
        message: `Image ${ino} Changing Error: Cannot Find User`,
        error: 'Unknown'
      });
  });
}

module.exports = router;
