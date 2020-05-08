const router = require("express").Router();
const multer = require('multer');
const uploadFile = multer({ storage: multer.memoryStorage() });
const AWS = require('../helpers/aws');
const GCS = require('../helpers/gcs');

router.get('/download/:uid/:uname', (req, res) => {
  const params = {
    Bucket: process.env.AB,
    Key: req.params.uid + '.zip'
  }
  res.attachment(req.params.uname + '.zip');
  // AWS.getObject(params)
  GCS.file(req.params.uid + '.zip').createReadStream().pipe(res);
});

router.get('/getSettings', (req, res) => {
  const params = {
    Bucket: process.env.AB,
    Key: 'settings.txt'
  };
  AWS.getObject(params, (s3Err, data) => {
    if (s3Err)
      return res.status(500).json({
        status: false,
        message: 'Settings Retrieve Error',
        error: s3Err
      });
    let jsonData = JSON.parse(data.Body.toString());
    return res.status(200).json({
      status: true,
      message: 'Settings Retrieved Successfully',
      data: jsonData,
      serverDate: new Date()
    });
  });
});

router.get('/getBanner/:bn', (req, res) => {
  const params = {
    Bucket: process.env.AB,
    Key: req.params.bn
  }
  res.attachment(req.params.bn);
  AWS.getObject(params).createReadStream().pipe(res);
});

module.exports = router;