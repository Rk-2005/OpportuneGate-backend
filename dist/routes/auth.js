"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt_1 = require("../utils/jwt");
const email_1 = require("../utils/email");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../utils/validation");
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
// Register
router.post('/register', async (req, res, next) => {
    try {
        const { error, value } = validation_1.registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const { email, password, role, firstName, lastName, phone, collegeCode, rollNo, branch } = value;
        // Check if user already exists
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        // Create user and related records in a transaction
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: role
                }
            });
            // Create profile
            await tx.profile.create({
                data: {
                    userId: user.id,
                    firstName,
                    lastName,
                    phone
                }
            });
            // Handle role-specific data
            if (role === 'STUDENT' && collegeCode && rollNo && branch) {
                // Find college by code
                const college = await tx.college.findUnique({
                    where: { code: collegeCode }
                });
                if (!college) {
                    throw new Error('College not found with the provided code');
                }
                // Create student record
                await tx.student.create({
                    data: {
                        userId: user.id,
                        collegeId: college.id,
                        rollNo,
                        branch
                    }
                });
            }
            else if (role === 'COMPANY') {
                // Company profile will be created separately via company registration
            }
            return user;
        });
        // Generate token
        const token = (0, jwt_1.generateToken)({
            id: result.id,
            email: result.email,
            role: result.role
        });
        // Send welcome email
        try {
            await (0, email_1.sendWelcomeEmail)(email, firstName, role);
        }
        catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: result.id,
                email: result.email,
                role: result.role
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Login
router.post('/login', async (req, res, next) => {
    try {
        const { error, value } = validation_1.loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const { email, password } = value;
        // Find user
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            include: {
                profile: true,
                college: true,
                company: true
            }
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Check password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Generate token
        const token = (0, jwt_1.generateToken)({
            id: user.id,
            email: user.email,
            role: user.role
        });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                profile: user.profile,
                college: user.college,
                company: user.company
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get current user
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                profile: true,
                college: true,
                company: true,
                students: {
                    include: {
                        college: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                profile: user.profile,
                college: user.college,
                company: user.company,
                students: user.students
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get colleges for student registration
router.get('/colleges', async (req, res, next) => {
    try {
        const colleges = await prisma_1.prisma.college.findMany({
            where: { isVerified: true },
            select: {
                id: true,
                name: true,
                code: true,
                city: true,
                state: true
            }
        });
        res.json({ colleges });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map