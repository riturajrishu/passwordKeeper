import User from '../models/User.js';

export const verifyAdmin = async (req, res, next) => {
    try {
        // req.user.uid is set by verifyToken middleware (which must run before this)
        const user = await User.findById(req.user.uid);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden - Admin access required' });
        }
        
        req.adminUser = user; // Attach DB user to req
        next();
    } catch (error) {
        console.error('Error in admin auth middleware', error);
        res.status(500).json({ message: 'Internal Server Error checking admin status' });
    }
};

export const verifySuperAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.uid);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Forbidden - Super Admin access required' });
        }
        
        req.adminUser = user;
        next();
    } catch (error) {
        console.error('Error in super admin auth middleware', error);
        res.status(500).json({ message: 'Internal Server Error checking superadmin status' });
    }
};
