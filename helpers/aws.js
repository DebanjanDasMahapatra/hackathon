const aws = require("aws-sdk");

module.exports = new aws.S3({
  region: process.env.AR,
  accessKeyId: process.env.AAKI,
  secretAccessKey: process.env.ASAK,
  Bucket: process.env.AB
});
