/**
 * validationMiddleware.js
 * Basic server-side input validation to ensure data integrity and security.
 */

export const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

export const registerValidator = (req, res, next) => {
    const { email, loginPassword, masterAuthHash } = req.body;

    if (!email || !validateEmail(email)) {
        return res.status(400).json({ message: 'Valid email is required' });
    }

    if (!loginPassword || loginPassword.length < 8) {
        return res.status(400).json({ message: 'Login password must be at least 8 characters' });
    }

    if (!masterAuthHash) {
        return res.status(400).json({ message: 'Security hash is missing' });
    }

    next();
};

export const vaultItemValidator = (req, res, next) => {
    const { encryptedBlob, category } = req.body;

    if (!encryptedBlob) {
        return res.status(400).json({ message: 'Encrypted items must have a data payload' });
    }

    if (category && category.length > 50) {
        return res.status(400).json({ message: 'Category name too long' });
    }

    next();
};
