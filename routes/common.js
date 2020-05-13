const router = require("express").Router();
const GCS = require('../helpers/gcs');

router.get('/view/:uname/:name', (req, res) => {
  res.attachment(`${req.params.name}.jpg`);
  GCS.file(req.params.uname + `/${req.params.name}.jpg`).createReadStream().pipe(res);
});

router.get('/getSettings', (req, res) => {
  let loadData = GCS.file('settings.txt').createReadStream();
  let text = '';
  loadData.on('data', (data) => {
    text += data;
  }).on('end', () => {
    let jsonData = JSON.parse(text);
    return res.status(200).json({
      status: true,
      message: 'Settings Retrieved Successfully',
      data: jsonData,
      serverDate: new Date()
    });
  }).on('error',(err) => {
    return res.status(500).json({
      status: false,
      message: 'Settings Retrieve Error',
      error: err
    });
  }); 
});

router.get('/getBanner/:bn', (req, res) => {
  res.attachment(req.params.bn);
  GCS.file('banner.jpg').createReadStream().pipe(res);
});

module.exports = router;