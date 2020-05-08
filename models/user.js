const mongoose = require('mongoose');
module.exports = mongoose.model('User',new mongoose.Schema({
    "name": {
        type: String,
        required: true
    },
    "username": {
        type: String,
        required: true,
        unique: true
    },
    "email": {
        type: String,
        required: true,
        unique: true
    },
    "stream": {
        type: String,
        default: ""
    },
    "yoc": {
        type: String,
        required: true
    },
    "itype": {
        type: String,
        required: true
    },
    "iname": {
        type: String,
        required: true
    },
    "contact": {
        type: String,
        required: true
    },
    "password": {
        type: String,
        required: true
    },
    "uploaded": {
        type: Boolean,
        default: false
    },
    "admin": {
        type: Boolean,
        default: false
    }
},{timestamps: true}));