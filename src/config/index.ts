import dotenv from 'dotenv';

// Set the NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const envFound = dotenv.config();
if (envFound.error) {
    throw new Error("Couldn't find .env file");
}

export default {
    port: parseInt(process.env.PORT, 10),

    databaseURL: process.env.DB_URL,

    kafkaConfig: {
        clientId: process.env.KAFKA_CLIENT_ID,
        brokers: process.env.KAFKA_BROKER,
        consumerGroupId: 'cloud-media-server-consumer',
    },
    /**
     * Used by winston logger
     */
    logs: {
        level: process.env.LOG_LEVEL || 'silly',
    },

    /**
     * API configs
     */
    api: {
        prefix: '/api',
    },

    /**
     * Auth Config
     */
    authConfig: {
        jwtSecret: process.env.JWT_SECRET,
        jwtPrivateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
        jwtAlgorithm: 'RS256',
        jwtTokenExpiry: '1h',
        verificationUrl: 'http://localhost:4000/api/auth/verify?verificationCode='
    },

    /**
     * Email Config
     */
    emailConfig: {
        username: process.env.EMAIL_ID,
        password: process.env.EMAIL_PASSWORD,
    },
};