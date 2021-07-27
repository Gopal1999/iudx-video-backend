import { DataTypes, Sequelize } from 'sequelize';
import { PolicyInterface } from '../interfaces/PolicyInterface';

export function PolicyModel(Database: Sequelize) {
    const model = Database.define<PolicyInterface>(
        'Policy',
        {
            policyId: {
                allowNull: false,
                primaryKey: true,
                type: DataTypes.UUID,
            },
            userId: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            streamId: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            providerId: {
                type: DataTypes.UUID,
                allowNull: false,
            },
        },
        {
            timestamps: true,
        }
    );

    return model;
}