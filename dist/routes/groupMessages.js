"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
// Send message to group (admin only)
router.post('/:groupId/messages', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { content } = req.body;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Message content is required' });
        }
        // Check if group belongs to admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id: groupId,
                adminId: req.user.id
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        if (!group.isActive) {
            return res.status(400).json({ message: 'This group is no longer active' });
        }
        // Create message
        const message = await prisma_1.prisma.groupMessage.create({
            data: {
                groupId,
                senderId: req.user.id,
                content: content.trim()
            },
            include: {
                sender: {
                    include: {
                        profile: true
                    }
                }
            }
        });
        // Create notifications for all group members
        const members = await prisma_1.prisma.groupMember.findMany({
            where: {
                groupId,
                isActive: true
            },
            select: {
                userId: true
            }
        });
        const notifications = members.map(member => ({
            userId: member.userId,
            groupId,
            title: 'New Group Message',
            message: `New message in "${group.name}": ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            type: 'group_message'
        }));
        await prisma_1.prisma.notification.createMany({
            data: notifications
        });
        res.status(201).json({
            message: 'Message sent successfully',
            data: message
        });
    }
    catch (error) {
        next(error);
    }
});
// Get group messages
router.get('/:groupId/messages', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        // Check if user is a member of the group or admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { adminId: req.user.id },
                    {
                        members: {
                            some: {
                                userId: req.user.id,
                                isActive: true
                            }
                        }
                    }
                ]
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found or access denied' });
        }
        const messages = await prisma_1.prisma.groupMessage.findMany({
            where: { groupId },
            include: {
                sender: {
                    include: {
                        profile: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: Number(limit)
        });
        const total = await prisma_1.prisma.groupMessage.count({
            where: { groupId }
        });
        res.json({
            messages: messages.reverse(), // Reverse to show oldest first
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
// Get group members
router.get('/:groupId/members', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        // Check if user is a member of the group or admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id: groupId,
                OR: [
                    { adminId: req.user.id },
                    {
                        members: {
                            some: {
                                userId: req.user.id,
                                isActive: true
                            }
                        }
                    }
                ]
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found or access denied' });
        }
        const members = await prisma_1.prisma.groupMember.findMany({
            where: {
                groupId,
                isActive: true
            },
            include: {
                user: {
                    include: {
                        profile: true
                    }
                }
            },
            orderBy: {
                joinedAt: 'asc'
            }
        });
        res.json({ members });
    }
    catch (error) {
        next(error);
    }
});
// Remove member from group (admin only)
router.delete('/:groupId/members/:userId', auth_1.authenticate, auth_1.authorizeAdmin, async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;
        // Check if group belongs to admin
        const group = await prisma_1.prisma.group.findFirst({
            where: {
                id: groupId,
                adminId: req.user.id
            }
        });
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        // Check if member exists
        const member = await prisma_1.prisma.groupMember.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId
                }
            }
        });
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        // Remove member
        await prisma_1.prisma.groupMember.update({
            where: {
                groupId_userId: {
                    groupId,
                    userId
                }
            },
            data: {
                isActive: false
            }
        });
        // Create notification for removed member
        await prisma_1.prisma.notification.create({
            data: {
                userId,
                groupId,
                title: 'Removed from Group',
                message: `You have been removed from the group "${group.name}"`,
                type: 'group_member_removed'
            }
        });
        res.json({ message: 'Member removed successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=groupMessages.js.map