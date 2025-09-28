"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (error, req, res, next) => {
    console.error('Error:', error);
    // Prisma errors
    if (error.code === 'P2002') {
        return res.status(400).json({
            message: 'A record with this information already exists.',
            field: error.meta?.target
        });
    }
    if (error.code === 'P2025') {
        return res.status(404).json({
            message: 'Record not found.'
        });
    }
    // JWT errors
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            message: 'Invalid token.'
        });
    }
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
            message: 'Token expired.'
        });
    }
    // Validation errors
    if (error.isJoi) {
        return res.status(400).json({
            message: 'Validation error',
            details: error.details
        });
    }
    // Default error
    res.status(error.status || 500).json({
        message: error.message || 'Internal server error.',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map