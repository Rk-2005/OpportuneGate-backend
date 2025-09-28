"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const crypto_1 = __importDefault(require("crypto"));
const router = express_1.default.Router();
// Generate unique invite code
const generateInviteCode = () => {
    return crypto_1.default.randomBytes(8).toString('hex').toUpperCase();
};
// Create a new group
router.post('/', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Group name is required' });
        }
        // Generate unique invite code
        let inviteCode = '';
        let isUnique = false;
        while (!isUnique) {
            inviteCode = generateInviteCode();
            const existingGroup = await prisma_1.prisma.group.findUnique({
                where: { inviteCode }
            });
            isUnique = !existingGroup;
        }
        // Get admin's college
        const admin = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: { college: true }
        });
        const group = await prisma_1.prisma.group.create({
            data: {
                name,
                description,
                inviteCode,
                adminId: req.user.id,
                collegeId: admin?.college?.id
            },
            include: {
                admin: {
                    include: {
                        profile: true
                    }
                },
                college: true,
                _count: {
                    select: {
                        members: true
                    }
                }
            }
        });
        res.status(201).json({
            message: 'Group created successfully',
            group
        });
    }
    catch (error) {
        next(error);
    }
});
// Get all groups for admin
router.get('/admin', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const groups = await prisma_1.prisma.group.findMany({
            where: {
                adminId: req.user.id
            },
            include: {
                admin: {
                    include: {
                        profile: true
                    }
                },
                college: true,
                members: {
                    include: {
                        user: {
                            include: {
                                profile: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        members: true,
                        opportunities: true,
                        messages: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json({ groups });
    }
    catch (error) {
        next(error);
    }
});
// Get group by invite code (for students to join)
router.get('/join/:inviteCode', auth_1.authenticate, async (req, res, next) => {
    try {
        const { inviteCode } = req.params;
        const group = await prisma_1.prisma.group.findUnique({
            where: { inviteCode },
            include: {
                admin: {
                    include: {
                        profile: true
                    }
                },
                college: true,
                _count: {
                    select: {
                        members: true
                    }
                }
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Invalid invite code' });
        }
        if (!group.isActive) {
            return res.status(400).json({ message: 'This group is no longer active' });
        }
        res.json({ group });
    }
    catch (error) {
        next(error);
    }
});
// Join group by invite code
router.post('/join/:inviteCode', auth_1.authenticate, async (req, res, next) => {
    try {
        const { inviteCode } = req.params;
        // Check if group exists and is active
        const group = await prisma_1.prisma.group.findUnique({
            where: { inviteCode }
        });
        if (!group) {
            return res.status(404).json({ message: 'Invalid invite code' });
        }
        if (!group.isActive) {
            return res.status(400).json({ message: 'This group is no longer active' });
        }
        // Check if user is already a member
        const existingMember = await prisma_1.prisma.groupMember.findUnique({
            where: {
                groupId_userId: {
                    groupId: group.id,
                    userId: req.user.id
                }
            }
        });
        if (existingMember) {
            return res.status(400).json({ message: 'You are already a member of this group' });
        }
        // Add user to group
        const groupMember = await prisma_1.prisma.groupMember.create({
            data: {
                groupId: group.id,
                userId: req.user.id
            },
            include: {
                group: {
                    include: {
                        admin: {
                            include: {
                                profile: true
                            }
                        }
                    }
                }
            }
        });
        // Create notification for admin
        await prisma_1.prisma.notification.create({
            data: {
                userId: group.adminId,
                groupId: group.id,
                title: 'New Group Member',
                message: `${req.user.email} joined your group "${group.name}"`,
                type: 'group_member_joined'
            }
        });
        res.status(201).json({
            message: 'Successfully joined the group',
            groupMember
        });
    }
    catch (error) {
        next(error);
    }
});
// Get user's groups
router.get('/my-groups', auth_1.authenticate, async (req, res, next) => {
    try {
        const groups = await prisma_1.prisma.groupMember.findMany({
            where: {
                userId: req.user.id,
                isActive: true
            },
            include: {
                group: {
                    include: {
                        admin: {
                            include: {
                                profile: true
                            }
                        },
                        college: true,
                        _count: {
                            select: {
                                members: true,
                                opportunities: true,
                                messages: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                joinedAt: 'desc'
            }
        });
        res.json({ groups: groups.map(gm => gm.group) });
    }
    catch (error) {
        next(error);
    }
});
// Regenerate invite code
router.patch('/:id/regenerate-invite', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if group belongs to admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id,
                adminId: req.user.id
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        // Generate new unique invite code
        let inviteCode;
        let isUnique = false;
        while (!isUnique) {
            inviteCode = generateInviteCode();
            const existingGroup = await prisma_1.prisma.group.findUnique({
                where: { inviteCode }
            });
            isUnique = !existingGroup;
        }
        const updatedGroup = await prisma_1.prisma.group.update({
            where: { id },
            data: { inviteCode },
            include: {
                admin: {
                    include: {
                        profile: true
                    }
                },
                college: true,
                _count: {
                    select: {
                        members: true
                    }
                }
            }
        });
        res.json({
            message: 'Invite code regenerated successfully',
            group: updatedGroup
        });
    }
    catch (error) {
        next(error);
    }
});
// Toggle group active status
router.patch('/:id/toggle-status', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if group belongs to admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id,
                adminId: req.user.id
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        const updatedGroup = await prisma_1.prisma.group.update({
            where: { id },
            data: { isActive: !group.isActive },
            include: {
                admin: {
                    include: {
                        profile: true
                    }
                },
                college: true,
                _count: {
                    select: {
                        members: true
                    }
                }
            }
        });
        res.json({
            message: `Group ${updatedGroup.isActive ? 'activated' : 'deactivated'} successfully`,
            group: updatedGroup
        });
    }
    catch (error) {
        next(error);
    }
});
// Delete group
router.delete('/:id', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if group belongs to admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id,
                adminId: req.user.id
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        await prisma_1.prisma.group.delete({
            where: { id }
        });
        res.json({ message: 'Group deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=groups.js.map