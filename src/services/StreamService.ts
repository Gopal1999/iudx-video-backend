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
        private streamStatusService: StreamStatusService,
    ) { }

    public async publishRegisteredStreams(streamData: Array<any>) {
        let streamsToPublish: Array<any> = [];

        const rtmpStreamData = streamData.map(stream => {
            const namespace: string = config.host.type + 'Stream';
            const streamId: string = new UUID().generateUUIDv5(namespace);
            const rtmpStreamUrl = `${config.rtmpServerConfig.serverUrl}/${streamId}?token=${config.rtmpServerConfig.password}`;

            streamsToPublish.push({
                inputStreamId: stream.streamId,
                outputStreamId: streamId,
                inputStreamUrl: stream.streamUrl,
                outputStreamUrl: rtmpStreamUrl,
            });

            return {
                streamId: streamId,
                cameraId: stream.cameraId,
                userId: stream.userId,
                provenanceStreamId: stream.streamId,
                sourceServerId: config.serverId,
                destinationServerId: config.serverId,
                streamName: stream.streamName,
                streamUrl: rtmpStreamUrl,
                streamType: 'RTMP',
                type: 'rtmp',
                isPublic: stream.isPublic,
            }
        });

        await this.streamRepo.registerStream(rtmpStreamData);

        streamsToPublish.map(stream => {
            this.processService.addStreamProcess(stream.inputStreamId, stream.outputStreamId,
                stream.inputStreamUrl, stream.outputStreamUrl);
        });
    }

    public async register(userId: string, streamData: Array<any>) {
        try {
            const streams: Array<any> = [];

            for (const stream of streamData) {
                const namespace: string = config.host.type + 'Stream';
                const streamId: string = new UUID().generateUUIDv5(namespace);

                const isDuplicateStream = await this.streamRepo.findStream(stream);
                const camera = await this.cameraRepo.findCamera({ cameraId: stream.cameraId });

                if (!camera || isDuplicateStream) {
                    return null;
                }

                streams.push({
                    streamId,
                    userId,
                    provenanceStreamId: streamId,
                    sourceServerId: config.serverId,
                    destinationServerId: config.serverId,
                    ...stream
                });
            }

            let result = await this.streamRepo.registerStream(streams);

            result = result.map((stream) => {
                return {
                    streamId: stream.streamId,
                    cameraId: stream.cameraId,
                    streamName: stream.streamName,
                    streamUrl: stream.streamUrl,
                    streamType: stream.streamType,
                    type: stream.type,
                    isPublic: stream.isPublic,
                };
            });
            await this.publishRegisteredStreams(streams);

            return result;
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error Registering the data');
        }
    }

    public async findOne(streamId: string): Promise<any> {
        try {
            const fields = [
                'streamId',
                'cameraId',
                'streamName',
                'streamType',
                'streamUrl',
                'streamType',
                'type',
                'isPublic',
            ];

            return await this.streamRepo.findStream({ streamId }, fields);
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error fetching the data');
        }
    }

    public async findAll(page: number, size: number) {
        try {
            const fields = [
                'streamId',
                'cameraId',
                'provenanceStreamId',
                'streamName',
                'streamType',
                'streamUrl',
                'streamType',
                'type',
                'isPublic',
            ];
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

    public async playBackUrl(streamId) {
        try {
            const stream = await this.streamRepo.findStream({ streamId });
            if (stream.isActive) {
                return {
                    urlTemplate: `${config.rtmpServerConfig.serverUrl}/${streamId}?token=<TOKEN>`,
                    isActive: true
                }
            } else {
                return {
                    isActive: false,
                    message: 'Stream will be available shortly, please check status API to know the status',
                    urlTemplate: `${config.rtmpServerConfig.serverUrl}/${streamId}}?token=<TOKEN>`
                }
            }
        } catch (e) {
            Logger.error(e);
            throw new ServiceError('Error getting playback url');
        }
    }
}
