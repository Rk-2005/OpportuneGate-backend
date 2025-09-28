"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const router = express_1.default.Router();
// Get user's notifications
router.get('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            userId: req.user.id
        };
        if (unreadOnly === 'true') {
            where.isRead = false;
        }
        const notifications = await prisma_1.prisma.notification.findMany({
            where,
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
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit)
        });
        const total = await prisma_1.prisma.notification.count({ where });
        const unreadCount = await prisma_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                isRead: false
            }
        });
        res.json({
            notifications,
            unreadCount,
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
// Mark notification as read
router.patch('/:id/read', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await prisma_1.prisma.notification.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        await prisma_1.prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        next(error);
    }
});
// Mark all notifications as read
router.patch('/mark-all-read', auth_1.authenticate, async (req, res, next) => {
    try {
        await prisma_1.prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        next(error);
    }
});
// Delete notification
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const notification = await prisma_1.prisma.notification.findFirst({
            where: {
                id,
                userId: req.user.id
            }
        });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        await prisma_1.prisma.notification.delete({
            where: { id }
        });
        res.json({ message: 'Notification deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Get notification statistics
router.get('/stats', auth_1.authenticate, async (req, res, next) => {
    try {
        const totalNotifications = await prisma_1.prisma.notification.count({
            where: { userId: req.user.id }
        });
        const unreadNotifications = await prisma_1.prisma.notification.count({
            where: {
                userId: req.user.id,
                isRead: false
            }
        });
        const notificationsByType = await prisma_1.prisma.notification.groupBy({
            by: ['type'],
            where: { userId: req.user.id },
            _count: {
                type: true
            }
        });
        res.json({
            totalNotifications,
            unreadNotifications,
            readNotifications: totalNotifications - unreadNotifications,
            notificationsByType: notificationsByType.map((item) => ({
                type: item.type,
                count: item._count.type
            }))
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=notification.js.map