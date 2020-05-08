const jwt = require('jsonwebtoken');

module.exports = {
    authenticateUser: (req, res, next) => {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.SECRET);
            if(!decoded.admin){
                req.user = decoded;
                next();
            }
            else
                return res.status(401).json({
                    status: false,
                    message: "Not Authorized"
                });
        } catch (err) {
            return res.status(401).json({
                status: false,
                message: "Not Authorized",
                error: err
            });
        }
    },

    authenticateAdmin: (req, res, next) => {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.SECRET);
            if(decoded.admin){
                req.user = decoded;
                next();
            }
            else
                return res.status(401).json({
                    status: false,
                    message: "Not Authorized"
                });
        } catch (err) {
            return res.status(401).json({
                status: false,
                message: "Not Authorized",
                error: err
            });
        }
    },

    authenticateAll: (req, res, next) => {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.SECRET);
            if(decoded) {
                req.user = decoded;
                next();
            }
            else
                return res.status(401).json({
                    status: false,
                    message: "Not Authorized"
                });
        } catch (err) {
            return res.status(401).json({
                status: false,
                message: "Not Authorized",
                error: err
            });
        }
    }
}