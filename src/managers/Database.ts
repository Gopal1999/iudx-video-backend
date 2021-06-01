import { Sequelize } from 'sequelize';
import Container from 'typedi';
import config from '../config';

import { UserModel } from '../models/UserModel';
import { CameraModel } from '../models/CameraModel';

const Database = new Sequelize(config.databaseURL, { dialect: 'postgres' });

const ModelDependencyInjector = () => {
    const models = [
        {
            name: 'UserModel',
            model: UserModel(Database),
        },
        {
            name: 'CameraModel',
            model: CameraModel(Database),
        },
    ];
    models.forEach((m) => {
        Container.set(m.name, m.model);
    });
};
export { Database, ModelDependencyInjector };