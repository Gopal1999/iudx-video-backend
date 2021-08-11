import { Service } from 'typedi';
import Logger from '../common/Logger';

import Utility from '../common/Utility';
import StreamRepo from '../repositories/StreamRepo';
import ServiceError from '../common/Error';
import CameraRepo from '../repositories/CameraRepo';
import UUID from '../common/UUID';
import config from '../config';
import ProcessService from './ProcessService';
import FfmpegService from './FfmpegService';
import StreamStatusService from './StreamStatusService';

@Service()
export default class StreamService {
    constructor(
        private utilityService: Utility,
        private streamRepo: StreamRepo,
        private cameraRepo: CameraRepo,
        private processService: ProcessService,
        private ffmpegService: FfmpegService,
        private streamStatusService: StreamStatusService
    ) {}

    public async publishRegisteredStreams(streamData: any) {
        const namespace: string = config.host.type + 'Stream';
        const streamId: string = new UUID().generateUUIDv5(namespace);
        const rtmpStreamUrl = `${config.rtmpServerConfig.serverUrl}/${streamId}?token=${config.rtmpServerConfig.password}`;
        const rtmpStreamData: any = {
            streamId,
            cameraId: streamData['cameraId'],
            userId: streamData['userId'],
            provenanceStreamId: streamData['streamId'],
            sourceServerId: config.serverId,
            destinationServerId: config.serverId,
            streamName: streamData['streamName'],
            streamUrl: rtmpStreamUrl,
            streamType: 'RTMP',
            type: 'rtmp',
            isPublic: streamData['isPublic'],
        };

        await this.streamRepo.registerStream(rtmpStreamData);
        this.processService.addStreamProcess(streamData['streamId'], streamId, rtmpStreamData.destinationServerId, rtmpStreamData.destinationServerId, streamData['streamUrl'], rtmpStreamUrl);
        return rtmpStreamData;
    }

    public async register(userId: string, streamData: any) {
        try {
            const namespace: string = config.host.type + 'Stream';
            const streamId: string = new UUID().generateUUIDv5(namespace);
            const isDuplicateStream = await this.streamRepo.findStream(streamData);
            const camera = await this.cameraRepo.findCamera({ cameraId: streamData['cameraId'] });

            if (!camera || isDuplicateStream) {
                return null;
            }

            streamData = {
                streamId,
                userId,
                provenanceStreamId: streamId,
                sourceServerId: config.serverId,
                destinationServerId: config.serverId,
                ...streamData,
            };

            await this.streamRepo.registerStream(streamData);
            const rtmpStreamData = await this.publishRegisteredStreams(streamData);
            return { streamData, rtmpStreamData };
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error Registering the data');
        }
    }

    public async findOne(streamId: string): Promise<any> {
        try {
            const fields = ['streamId', 'cameraId', 'streamName', 'streamType', 'streamUrl', 'streamType', 'type', 'isPublic'];

            return await this.streamRepo.findStream({ streamId }, fields);
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error fetching the data');
        }
    }

    public async findAll(page: number, size: number) {
        try {
            const fields = ['streamId', 'cameraId', 'provenanceStreamId', 'streamName', 'streamType', 'streamUrl', 'streamType', 'type', 'isPublic'];
            const { limit, offset } = this.utilityService.getPagination(page, size);
            const streams = await this.streamRepo.listAllStreams(limit, offset, fields);
            const response = this.utilityService.getPagingData(streams, page, limit);
            return response;
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error fetching the data');
        }
    }

    public async delete(streamId: string) {
        try {
            const streamData = await this.streamRepo.findStream({ streamId, type: 'camera' });

            if (!streamData) {
                return 0;
            }

            const streams = await this.streamRepo.getAllAssociatedStreams(streamId);

            for (const stream of streams) {
                if (stream.processId) {
                    const isProcessRunning = await this.ffmpegService.isProcessRunning(stream.processId);

                    if (isProcessRunning) {
                        await this.ffmpegService.killProcess(stream.processId);
                    }
                }
                await this.streamRepo.deleteStream({ streamId: stream.streamId });
            }

            return 1;
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error deleting the data');
        }
    }

    public async getStatus(streamId) {
        try {
            const status = await this.streamStatusService.getStatus(streamId);
            return status;
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error fetching status');
        }
    }

    public async streamRequest(streamId: string, requestType: any) {
        try {
            if (requestType === 'cloud') {
                // Checking if previously LMS to CMS stream was created, if its created we will have multiple records
                let existingStreamRecord = await this.streamRepo.findStream({ streamId, destinationServerId: config.serverId });

                let isExistingStream = !!existingStreamRecord;

                let lmsRtmpStream;

                // Get LMS RTMP Stream using stream id and server ids
                if (isExistingStream) {
                    lmsRtmpStream = await this.streamRepo.findStream({ streamId, destinationServerId: existingStreamRecord.sourceServerId });
                } else {
                    lmsRtmpStream = await this.streamRepo.findStream({ streamId });
                }

                return {
                    apiResponse: {
                        urlTemplate: `rtmp://${config.rtmpServerConfig.publicServerIp}:${config.rtmpServerConfig.publicServerPort}/live/${streamId}?token=<TOKEN>`,
                        isPublishing: !!lmsRtmpStream.isPublishing,
                        ...(!lmsRtmpStream.isPublishing && { message: 'Stream will be available shortly, please check status API to know the status' }),
                    },
                    kafkaRequestData: {
                        serverId: lmsRtmpStream.sourceServerId,
                        data: {
                            cmsServerId: config.serverId,
                            isExistingStream,
                            streamData: {
                                streamId: lmsRtmpStream['streamId'],
                                cameraId: lmsRtmpStream['cameraId'],
                                userId: lmsRtmpStream['userId'],
                                provenanceStreamId: lmsRtmpStream['streamId'],
                                sourceServerId: lmsRtmpStream['sourceServerId'],
                                destinationServerId: lmsRtmpStream['destinationServerId'],
                                streamName: lmsRtmpStream['streamName'],
                                isPublic: lmsRtmpStream['isPublic'],
                                streamUrl: lmsRtmpStream['streamUrl'],
                            },
                        },
                    },
                };
            } else if (requestType === 'local') {
                const stream = await this.streamRepo.findStream({ streamId });

                // TODO - server address needs to fetched
                return {
                    apiResponse: {
                        urlTemplate: `rtmp://localhost:1935/live/${streamId}?token=<TOKEN>`,
                        isPublishing: !!stream.isPublishing,
                        ...(!stream.isPublishing && { message: 'Stream will be available shortly, please check status API to know the status' }),
                    },
                };
            }
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error getting playback url');
        }
    }

    public async publishStreamToCloud(cmsServerId: string, lmsStreamData: any) {
        const rtmpStreamUrl = `rtmp://${config.rtmpServerConfig.cmsServerIp}:${config.rtmpServerConfig.cmsServerPort}/live/${lmsStreamData['streamId']}?token=${config.rtmpServerConfig.password}`;
        const cmsRtmpStreamData: any = {
            streamId: lmsStreamData['streamId'],
            cameraId: lmsStreamData['cameraId'],
            userId: lmsStreamData['userId'],
            provenanceStreamId: lmsStreamData['streamId'],
            sourceServerId: lmsStreamData['sourceServerId'],
            destinationServerId: cmsServerId,
            streamName: lmsStreamData['streamName'],
            streamUrl: rtmpStreamUrl,
            streamType: 'RTMP',
            type: 'rtmp',
            isPublic: lmsStreamData['isPublic'],
        };

        // Using upsert to create or update the record
        await this.streamRepo.upsertStream(cmsRtmpStreamData);

        this.processService.addStreamProcess(lmsStreamData['streamId'], lmsStreamData['streamId'], lmsStreamData['sourceServerId'], cmsServerId, lmsStreamData['streamUrl'], rtmpStreamUrl);
        return cmsRtmpStreamData;
    }
}
