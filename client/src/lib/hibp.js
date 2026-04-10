import CryptoJS from 'crypto-js';

/**
 * Checks if a password has been found in known data breaches.
 * Uses k-anonymity: only first 5 chars of SHA1 hash are sent to the API.
 * @returns {number} breach count, 0 if safe, false if network error
 */
export const checkPasswordBreach = async (password) => {
  try {
    const sha1 = CryptoJS.SHA1(password).toString().toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;

    const text = await res.text();
    for (const line of text.split('\n')) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return parseInt(count.trim(), 10);
      }
    }
    return 0;
  } catch {
    return false;
  }
};
