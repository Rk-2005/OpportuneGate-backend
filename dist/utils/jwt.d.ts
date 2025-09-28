import jwt from 'jsonwebtoken';
export declare const generateToken: (payload: {
    id: string;
    email: string;
    role: string;
}) => string;
export declare const verifyToken: (token: string) => string | jwt.JwtPayload;
//# sourceMappingURL=jwt.d.ts.map