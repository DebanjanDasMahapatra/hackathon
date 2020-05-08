const router = require('express').Router();
const multer = require('multer');
const uploadFile = multer({ storage: multer.memoryStorage() });

const User = require('../models/user');
const Auth = require("../middlewares/auth");
const AWS = require("../helpers/aws");

router.get("/fetchUsers",  (req, res) => {
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

router.get("/deleteUser/:username", Auth.authenticateAdmin, (req, res) => {
  User.findOneAndRemove({username: req.params.username}, (err, deletedUser) => {
    if (err)
      return res.status(500).json({
        status: false,
        message: "Deleting User Failed! Server Error..",
        error: err
      });
    if(deletedUser) {
      const params = {
        Bucket: process.env.AB,
        Key: deletedUser._id + '.zip'
      }
      AWS.deleteObject(params, (err, data) => {
        if (err)
          return res.status(500).json({
            status: false,
            message: 'Cannot Delete User Submission, User Entry Deleted in DB.',
            error: err
          });
        return res.status(200).json({
          status: true,
          message: "Deleted successfully",
          user: deletedUser
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
  const params = {
    Bucket: process.env.AB,
    Key: 'settings.txt',
    Body: new Buffer(fileData,'utf-8')
  };
  AWS.upload(params, (s3Err, data) => {
    if (s3Err)
      return res.status(500).json({
        status: false,
        message: 'Settings Update Error'+(fromBanner ? ', Banner Updated Successfully' : ''),
        error: s3Err
      });
    console.log(`Settings uploaded Successfully at ${data.Location}`);
    return res.status(200).json({
      status: true,
      message: 'Settings'+(fromBanner ? ' and Banner' : '')+' Updated Successfully'
    });
  });
}

let updateBanner = (buffer, fileName, res, settingsData = undefined) => {
  const params = {
    Bucket: process.env.AB,
    Key: fileName,
    Body: buffer
  };
  AWS.upload(params, (s3Err, data) => {
    if (s3Err)
      return res.status(500).json({
        status: false,
        message: 'Banner Update Error',
        error: s3Err
      });
    console.log(`Banner uploaded Successfully at ${data.Location}`);
    if(settingsData) {
      settingsData.banner = fileName;
      updateSettings(settingsData, res, true);
    }
    else
      return res.status(200).json({
        status: true,
        message: 'Banner Updated Successfully'
      });
  });
}

module.exports = router;
