"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../utils/validation");
const email_1 = require("../utils/email");
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
// Get all opportunities (with filters)
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { type, company, college, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            isActive: true,
            applicationDeadline: {
                gt: new Date()
            }
        };
        if (type) {
            where.type = type;
        }
        if (company) {
            where.company = {
                name: {
                    contains: company,
                    mode: 'insensitive'
                }
            };
        }
        if (college) {
            where.college = {
                name: {
                    contains: college,
                    mode: 'insensitive'
                }
            };
        }
        // If user is a student, filter by their college
        if (req.user.role === 'STUDENT') {
            const student = await prisma_1.prisma.student.findUnique({
                where: { userId: req.user.id },
                include: { college: true }
            });
            if (student) {
                where.OR = [
                    { collegeId: student.collegeId },
                    { collegeId: null } // Global opportunities
                ];
            }
        }
        const opportunities = await prisma_1.prisma.opportunity.findMany({
            where,
            include: {
                company: {
                    select: {
                        name: true,
                        website: true,
                        industry: true
                    }
                },
                college: {
                    select: {
                        name: true,
                        city: true,
                        state: true
                    }
                },
                applications: {
                    where: req.user.role === 'STUDENT' ? {
                        studentId: req.user.id
                    } : undefined,
                    select: {
                        id: true,
                        status: true,
                        appliedAt: true,
                        studentId: true
                    }
                },
                _count: {
                    select: {
                        applications: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit)
        });
        const total = await prisma_1.prisma.opportunity.count({ where });
        res.json({
            opportunities,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
});
let a = 1;
// Get single opportunity
router.get('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const opportunity = await prisma_1.prisma.opportunity.findUnique({
            where: { id: req.params.id },
            include: {
                company: true,
                college: true,
                applications: {
                    where: {
                        studentId: req.user.role === 'STUDENT' ? req.user.id : undefined
                    }
                }
            }
        });
        if (!opportunity) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        res.json({ opportunity });
    }
    catch (error) {
        next(error);
    }
});
// Create opportunity
router.post('/', auth_1.authenticate, auth_1.authorizeAdminOrCompany, async (req, res, next) => {
    try {
        const { error, value } = validation_1.opportunitySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const { title, description, type, eligibility, requirements, benefits, location, salary, duration, applicationDeadline, groupId, rounds } = value;
        // Convert empty string groupId to null for database storage
        const processedGroupId = groupId && groupId.trim() !== '' ? groupId : null;
        let collegeId = null;
        let companyId = null;
        // Determine if this is posted by admin or company
        if (req.user.role === 'ADMIN') {
            const college = await prisma_1.prisma.college.findUnique({
                where: { adminId: req.user.id }
            });
            collegeId = college?.id || null;
        }
        else if (req.user.role === 'COMPANY') {
            const company = await prisma_1.prisma.company.findUnique({
                where: { userId: req.user.id }
            });
            companyId = company?.id || null;
        }
        const opportunity = await prisma_1.prisma.opportunity.create({
            data: {
                title,
                description,
                type: type,
                eligibility,
                requirements,
                benefits,
                location,
                salary,
                duration,
                applicationDeadline: new Date(applicationDeadline),
                postedBy: req.user.id,
                collegeId,
                companyId,
                groupId: processedGroupId,
                rounds: rounds || null
            },
            include: {
                company: true,
                college: true,
                group: {
                    select: {
                        id: true,
                        name: true,
                        inviteCode: true
                    }
                }
            }
        });
        // Send notifications based on targeting
        try {
            if (processedGroupId) {
                // Send notifications only to group members
                const groupMembers = await prisma_1.prisma.groupMember.findMany({
                    where: {
                        groupId: processedGroupId,
                        isActive: true
                    },
                    include: {
                        user: {
                            include: {
                                profile: true
                            }
                        }
                    }
                });
                const notifications = groupMembers.map(member => ({
                    userId: member.userId,
                    opportunityId: opportunity.id,
                    groupId: processedGroupId,
                    title: 'New Group Opportunity',
                    message: `New ${opportunity.type.toLowerCase()} opportunity in "${opportunity.group?.name}": ${opportunity.title}`,
                    type: 'opportunity'
                }));
                await prisma_1.prisma.notification.createMany({
                    data: notifications
                });
                // Send email notifications to group members
                for (const member of groupMembers) {
                    await (0, email_1.sendOpportunityNotification)(member.user.email, member.user.profile?.firstName || 'Student', opportunity.title);
                }
                // Emit real-time notification to group members
                const io = req.app.get('io');
                if (io) {
                    groupMembers.forEach(member => {
                        io.to(`user_${member.userId}`).emit('newOpportunity', {
                            id: opportunity.id,
                            title: opportunity.title,
                            type: opportunity.type,
                            company: opportunity.company?.name || opportunity.college?.name,
                            deadline: opportunity.applicationDeadline,
                            groupName: opportunity.group?.name
                        });
                    });
                }
            }
            else {
                // Send notifications to all eligible students (existing logic)
                await sendNotificationsToEligibleStudents(opportunity);
                // Emit real-time notification to all students
                const io = req.app.get('io');
                if (io) {
                    const students = await prisma_1.prisma.student.findMany({
                        include: { user: true }
                    });
                    students.forEach(student => {
                        io.to(`user_${student.userId}`).emit('newOpportunity', {
                            id: opportunity.id,
                            title: opportunity.title,
                            type: opportunity.type,
                            company: opportunity.company?.name || opportunity.college?.name,
                            deadline: opportunity.applicationDeadline
                        });
                    });
                }
            }
        }
        catch (notificationError) {
            console.error('Failed to send notifications:', notificationError);
        }
        res.status(201).json({
            message: 'Opportunity created successfully',
            opportunity
        });
    }
    catch (error) {
        next(error);
    }
});
// Update opportunity
router.put('/:id', auth_1.authenticate, auth_1.authorizeAdminOrCompany, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if user owns this opportunity
        const existingOpportunity = await prisma_1.prisma.opportunity.findUnique({
            where: { id }
        });
        if (!existingOpportunity) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        if (existingOpportunity.postedBy !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this opportunity' });
        }
        const { error, value } = validation_1.opportunitySchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }
        const opportunity = await prisma_1.prisma.opportunity.update({
            where: { id },
            data: {
                ...value,
                applicationDeadline: new Date(value.applicationDeadline)
            },
            include: {
                company: true,
                college: true
            }
        });
        res.json({
            message: 'Opportunity updated successfully',
            opportunity
        });
    }
    catch (error) {
        next(error);
    }
});
// Delete opportunity
router.delete('/:id', auth_1.authenticate, auth_1.authorizeAdminOrCompany, async (req, res, next) => {
    try {
        const { id } = req.params;
        const existingOpportunity = await prisma_1.prisma.opportunity.findUnique({
            where: { id }
        });
        if (!existingOpportunity) {
            return res.status(404).json({ message: 'Opportunity not found' });
        }
        if (existingOpportunity.postedBy !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to delete this opportunity' });
        }
        await prisma_1.prisma.opportunity.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({ message: 'Opportunity deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Helper function to send notifications to eligible students
async function sendNotificationsToEligibleStudents(opportunity) {
    try {
        // Get all students who might be eligible
        const students = await prisma_1.prisma.student.findMany({
            include: {
                user: {
                    include: {
                        profile: true
                    }
                },
                college: true
            }
        });
        // Filter eligible students based on opportunity criteria
        const eligibleStudents = students.filter((student) => {
            const profile = student.user.profile;
            if (!profile)
                return false;
            // Basic eligibility check (can be enhanced)
            const eligibility = opportunity.eligibility;
            if (eligibility.minCGPA && profile.cgpa && profile.cgpa < eligibility.minCGPA) {
                return false;
            }
            if (eligibility.minSSC && profile.sscPercent && profile.sscPercent < eligibility.minSSC) {
                return false;
            }
            if (eligibility.minHSC && profile.hscPercent && profile.hscPercent < eligibility.minHSC) {
                return false;
            }
            if (eligibility.year && profile.currentYear && profile.currentYear !== eligibility.year) {
                return false;
            }
            if (eligibility.branch && !eligibility.branch.includes(student.branch)) {
                return false;
            }
            return true;
        });
        // Create notifications and send emails
        for (const student of eligibleStudents) {
            // Create notification
            await prisma_1.prisma.notification.create({
                data: {
                    userId: student.userId,
                    opportunityId: opportunity.id,
                    title: `New Opportunity: ${opportunity.title}`,
                    message: `A new opportunity "${opportunity.title}" has been posted that matches your profile.`,
                    type: 'opportunity'
                }
            });
            // Send email notification
            try {
                await (0, email_1.sendOpportunityNotification)(student.user.email, `${student.user.profile?.firstName} ${student.user.profile?.lastName}`, opportunity.title);
            }
            catch (emailError) {
                console.error('Failed to send email to student:', student.user.email, emailError);
            }
        }
        console.log(`Sent notifications to ${eligibleStudents.length} eligible students`);
    }
    catch (error) {
        console.error('Error sending notifications:', error);
    }
}
exports.default = router;
//# sourceMappingURL=opportunity.js.map