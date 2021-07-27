import { Router } from 'express';
import passport from 'passport';

import StreamManagementController from '../controllers/StreamManagementController';
import { AuthorizeRole, ValidateStreamAccess, ValidatePolicy } from '../middlewares/Authorization';
import { validatePaginationQuery } from '../middlewares/ValidateQuery';

const route = Router();

export default (app: Router) => {

    const StreamController = new StreamManagementController();

    app.use('/streams', passport.authenticate('jwt', { session: true }), route);

    route.post('/',
        AuthorizeRole(['cms-admin', 'lms-admin', 'provider']),
        (req, res, next) => StreamController.register(req, res, next)
    );

    route.get('/:streamId',
        (req, res, next) => StreamController.findOne(req, res, next)
    );

    route.get('/',
        validatePaginationQuery(['page', 'size']),
        (req, res, next) => StreamController.findAll(req, res, next)
    );

    route.delete('/:streamId',
        AuthorizeRole(['cms-admin', 'lms-admin', 'provider']),
        ValidateStreamAccess,
        (req, res, next) => StreamController.delete(req, res, next)
    );

    route.get('/status/:streamId',
        (req, res, next) => StreamController.getStatus(req, res, next)
    );

    route.get('/playback/:streamId', ValidatePolicy,
        (req, res, next) => StreamController.playBackUrl(req, res, next)
    );
}