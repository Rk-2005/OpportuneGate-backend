"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../utils/validation");
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
// Get profile
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const profile = await prisma_1.prisma.profile.findUnique({
            where: { userId: req.user.id },
            include: {
                user: {
                    select: {
                        email: true,
                        role: true,
                        createdAt: true
                    }
                }
            }
        });
        if (!profile) {
            // Create a default profile if it doesn't exist
            const newProfile = await prisma_1.prisma.profile.create({
                data: {
                    userId: req.user.id,
                    firstName: '',
                    lastName: '',
                },
                include: {
                    user: {
                        select: {
                            email: true,
                            role: true,
                            createdAt: true
                        }
                    }
                }
            });
            return res.json({
                profile: newProfile,
                completionPercentage: 0
            });
        }
        // Calculate profile completion percentage
        const completionFields = [
            profile.firstName,
            profile.lastName,
            profile.phone,
            profile.sscPercent,
            profile.hscPercent,
            profile.cgpa,
            profile.currentYear,
            profile.resume
        ];
        const completedFields = completionFields.filter(field => field !== null && field !== undefined).length;
        const completionPercentage = Math.round((completedFields / completionFields.length) * 100);
        res.json({
            profile,
            completionPercentage
        });
    }
    catch (error) {
        next(error);
    }
});
// Update profile
router.put('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { error, value } = validation_1.updateProfileSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        // Check if profile exists, if not create it
        let profile = await prisma_1.prisma.profile.findUnique({
            where: { userId: req.user.id }
        });
        if (!profile) {
            // Create profile if it doesn't exist
            profile = await prisma_1.prisma.profile.create({
                data: {
                    userId: req.user.id,
                    firstName: value.firstName || '',
                    lastName: value.lastName || '',
                    phone: value.phone || null,
                    sscPercent: value.sscPercent || null,
                    hscPercent: value.hscPercent || null,
                    cgpa: value.cgpa || null,
                    currentYear: value.currentYear || null,
                    resume: value.resume || null,
                },
                include: {
                    user: {
                        select: {
                            email: true,
                            role: true,
                            createdAt: true
                        }
                    }
                }
            });
        }
        else {
            // Update existing profile
            profile = await prisma_1.prisma.profile.update({
                where: { userId: req.user.id },
                data: value,
                include: {
                    user: {
                        select: {
                            email: true,
                            role: true,
                            createdAt: true
                        }
                    }
                }
            });
        }
        // Calculate completion percentage
        const completionFields = [
            profile.firstName,
            profile.lastName,
            profile.phone,
            profile.sscPercent,
            profile.hscPercent,
            profile.cgpa,
            profile.currentYear,
            profile.resume
        ];
        const completedFields = completionFields.filter(field => field !== null && field !== undefined).length;
        const completionPercentage = Math.round((completedFields / completionFields.length) * 100);
        res.json({
            message: 'Profile updated successfully',
            profile,
            completionPercentage
        });
    }
    catch (error) {
        next(error);
    }
});
// Upload resume
router.post('/resume', auth_1.authenticate, async (req, res, next) => {
    try {
        // In a real application, you would handle file upload here
        // For now, we'll just accept a URL or file path
        const { resumeUrl } = req.body;
        if (!resumeUrl) {
            return res.status(400).json({ message: 'Resume URL is required' });
        }
        const profile = await prisma_1.prisma.profile.update({
            where: { userId: req.user.id },
            data: { resume: resumeUrl }
        });
        res.json({
            message: 'Resume uploaded successfully',
            profile
        });
    }
    catch (error) {
        next(error);
    }
});
// Get profile statistics (for admin/company view)
router.get('/stats/:userId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const profile = await prisma_1.prisma.profile.findUnique({
            where: { userId },
            include: {
                user: {
                    include: {
                        applications: {
                            include: {
                                opportunity: {
                                    select: {
                                        title: true,
                                        company: {
                                            select: {
                                                name: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        const stats = {
            totalApplications: profile.user.applications.length,
            placedApplications: profile.user.applications.filter((app) => app.status === 'PLACED').length,
            pendingApplications: profile.user.applications.filter((app) => ['APPLIED', 'APTITUDE', 'TECHNICAL', 'INTERVIEW'].includes(app.status)).length,
            isPlaced: profile.isPlaced,
            placedAt: profile.placedAt
        };
        res.json({ profile, stats });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=profile.js.map