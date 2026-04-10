/**
 * Pure JavaScript Implementation of Shamir's Secret Sharing in Galois Field GF(2^8)
 * Ensures 100% Client-Side Zero-Knowledge Cryptographic Recovery.
 */

// Generate Galois Field 2^8 Log and Exp tables using standard primitive polynomial 0x11D
const logs = new Uint8Array(256);
const exps = new Uint8Array(256);

let x = 1;
for (let i = 0; i < 256; i++) {
    exps[i] = x;
    logs[x] = i;
    x <<= 1;
    if (x & 256) {
        x ^= 0x11D; // x^8 + x^4 + x^3 + x^2 + 1
    }
}

// GF(2^8) math operations
const add = (a, b) => a ^ b;
const sub = (a, b) => a ^ b;
const mul = (a, b) => (a === 0 || b === 0) ? 0 : exps[(logs[a] + logs[b]) % 255];
const div = (a, b) => (a === 0 || b === 0) ? 0 : exps[(logs[a] - logs[b] + 255) % 255];

/**
 * Evaluates polynomial at x
 */
const evalPoly = (poly, x) => {
    let result = 0;
    for (let i = poly.length - 1; i >= 0; i--) {
        result = add(mul(result, x), poly[i]);
    }
    return result;
};

/**
 * Splits a string secret into N shares, requiring K shares to recover
 */
export const splitSecret = (secret, n = 5, k = 3) => {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);
    
    // Each share will be represented as an array of bytes
    const shares = Array.from({ length: n }, (_, i) => [i + 1]); // the first byte of a share is its x-coordinate

    // For every byte in the secret, we form a polynomial of degree k-1
    for (let i = 0; i < secretBytes.length; i++) {
        const poly = new Uint8Array(k);
        poly[0] = secretBytes[i]; // f(0) = secret

        // generate random coefficients
        for (let j = 1; j < k; j++) {
            poly[j] = Math.floor(Math.random() * 255) + 1; // 1-255
        }

        // evaluate for each share
        for (let j = 0; j < n; j++) {
            const xVal = shares[j][0];
            const yVal = evalPoly(poly, xVal);
            shares[j].push(yVal);
        }
    }

    // Convert share arrays to hex strings for the user
    return shares.map(share => {
        return Array.from(share).map(b => b.toString(16).padStart(2, '0')).join('');
    });
};

/**
 * Recovers the secret from K shares
 */
export const recoverSecret = (hexShares) => {
    if (hexShares.length === 0) return null;

    // Parse back from hex string to byte array
    const parsedShares = hexShares.map(hexStr => {
        const bytes = [];
        for (let i = 0; i < hexStr.length; i += 2) {
            bytes.push(parseInt(hexStr.substr(i, 2), 16));
        }
        return bytes;
    });

    const secretLength = parsedShares[0].length - 1;
    const secretBytes = new Uint8Array(secretLength);

    for (let i = 0; i < secretLength; i++) {
        let secretByte = 0;

        // Lagrange interpolation at x = 0
        for (let j = 0; j < parsedShares.length; j++) {
            let num = 1;
            let den = 1;

            const xj = parsedShares[j][0];
            const yj = parsedShares[j][i + 1];

            for (let m = 0; m < parsedShares.length; m++) {
                if (j === m) continue;
                const xm = parsedShares[m][0];
                
                // lagrange basis polynomial l_j(0) = product( (0 - xm) / (xj - xm) )
                num = mul(num, sub(0, xm));
                den = mul(den, sub(xj, xm));
            }

            const basis = div(num, den);
            const term = mul(yj, basis);
            secretByte = add(secretByte, term);
        }

        secretBytes[i] = secretByte;
    }

    const decoder = new TextDecoder();
    return decoder.decode(secretBytes);
};
