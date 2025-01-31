import {
    Channel,
    NullChannel,
    NullEncryptedPrivateChannel,
    NullPresenceChannel,
    NullPrivateChannel,
    PresenceChannel,
    PusherChannel,
    PusherEncryptedPrivateChannel,
    PusherPresenceChannel,
    PusherPrivateChannel,
    SocketIoChannel,
    SocketIoPresenceChannel,
    SocketIoPrivateChannel,
} from './channel';
import { Connector, PusherConnector, SocketIoConnector, NullConnector } from './connector';
import { isConstructor } from './util';

/**
 * This class is the primary API for interacting with broadcasting.
 */
export default class Echo<T extends keyof Broadcaster> {
    /**
     * The broadcasting connector.
     */
    connector: Broadcaster[T]['connector'];

    /**
     * The Echo options.
     */
    options: EchoOptions<T>;

    /**
     * Create a new class instance.
     */
    constructor(options: EchoOptions<T>) {
        this.options = options;
        this.connect();

        if (!this.options.withoutInterceptors) {
            this.registerInterceptors();
        }
    }

    /**
     * Get a channel instance by name.
     */
    channel(channel: string): Broadcaster[T]['public'] {
        return this.connector.channel(channel);
    }

    /**
     * Create a new connection.
     */
    connect(): void {
        if (this.options.broadcaster == 'reverb') {
            this.connector = new PusherConnector({ ...this.options, cluster: '' });
        } else if (this.options.broadcaster == 'pusher') {
            this.connector = new PusherConnector(this.options);
        } else if (this.options.broadcaster == 'socket.io') {
            this.connector = new SocketIoConnector(this.options);
        } else if (this.options.broadcaster == 'null') {
            this.connector = new NullConnector(this.options);
        } else if (typeof this.options.broadcaster == 'function' && isConstructor(this.options.broadcaster)) {
            this.connector = new this.options.broadcaster(this.options as EchoOptions<'function'>);
        } else {
            throw new Error(
                `Broadcaster ${typeof this.options.broadcaster} ${this.options.broadcaster} is not supported.`
            );
        }
    }

    /**
     * Disconnect from the Echo server.
     */
    disconnect(): void {
        this.connector.disconnect();
    }

    /**
     * Get a presence channel instance by name.
     */
    join(channel: string): Broadcaster[T]['presence'] {
        return this.connector.presenceChannel(channel);
    }

    /**
     * Leave the given channel, as well as its private and presence variants.
     */
    leave(channel: string): void {
        this.connector.leave(channel);
    }

    /**
     * Leave the given channel.
     */
    leaveChannel(channel: string): void {
        this.connector.leaveChannel(channel);
    }

    /**
     * Leave all channels.
     */
    leaveAllChannels(): void {
        for (const channel in this.connector.channels) {
            this.leaveChannel(channel);
        }
    }

    /**
     * Listen for an event on a channel instance.
     */
    listen(channel: string, event: string, callback: Function): Broadcaster[T]['public'] {
        return this.connector.listen(channel, event, callback);
    }

    /**
     * Get a private channel instance by name.
     */
    private(channel: string): Broadcaster[T]['private'] {
        return this.connector.privateChannel(channel);
    }

    /**
     * Get a private encrypted channel instance by name.
     */
    encryptedPrivate(channel: string): Broadcaster[T]['encrypted'] {
        if ((this.connector as any) instanceof SocketIoConnector) {
            throw new Error(
                `Broadcaster ${typeof this.options.broadcaster} ${
                    this.options.broadcaster
                } does not support encrypted private channels.`
            );
        }

        return this.connector.encryptedPrivateChannel(channel);
    }

    /**
     * Get the Socket ID for the connection.
     */
    socketId(): string {
        return this.connector.socketId();
    }

    /**
     * Register 3rd party request interceptiors. These are used to automatically
     * send a connections socket id to a Laravel app with a X-Socket-Id header.
     */
    registerInterceptors(): void {
        if (typeof Vue === 'function' && Vue.http) {
            this.registerVueRequestInterceptor();
        }

        if (typeof axios === 'function') {
            this.registerAxiosRequestInterceptor();
        }

        if (typeof jQuery === 'function') {
            this.registerjQueryAjaxSetup();
        }

        if (typeof Turbo === 'object') {
            this.registerTurboRequestInterceptor();
        }
    }

    /**
     * Register a Vue HTTP interceptor to add the X-Socket-ID header.
     */
    registerVueRequestInterceptor(): void {
        Vue.http.interceptors.push((request, next) => {
            if (this.socketId()) {
                request.headers.set('X-Socket-ID', this.socketId());
            }

            next();
        });
    }

    /**
     * Register an Axios HTTP interceptor to add the X-Socket-ID header.
     */
    registerAxiosRequestInterceptor(): void {
        axios.interceptors.request.use((config) => {
            if (this.socketId()) {
                config.headers['X-Socket-Id'] = this.socketId();
            }

            return config;
        });
    }

    /**
     * Register jQuery AjaxPrefilter to add the X-Socket-ID header.
     */
    registerjQueryAjaxSetup(): void {
        if (typeof jQuery.ajax != 'undefined') {
            jQuery.ajaxPrefilter((options, originalOptions, xhr) => {
                if (this.socketId()) {
                    xhr.setRequestHeader('X-Socket-Id', this.socketId());
                }
            });
        }
    }

    /**
     * Register the Turbo Request interceptor to add the X-Socket-ID header.
     */
    registerTurboRequestInterceptor(): void {
        document.addEventListener('turbo:before-fetch-request', (event: any) => {
            event.detail.fetchOptions.headers['X-Socket-Id'] = this.socketId();
        });
    }
}

/**
 * Export channel classes for TypeScript.
 */
export { Connector, Channel, PresenceChannel };

export { EventFormatter } from './util';

/**
 * Specifies the broadcaster
 */
type Broadcaster = {
    reverb: {
        connector: PusherConnector;
        public: PusherChannel;
        private: PusherPrivateChannel;
        encrypted: PusherEncryptedPrivateChannel;
        presence: PusherPresenceChannel;
    };
    pusher: {
        connector: PusherConnector;
        public: PusherChannel;
        private: PusherPrivateChannel;
        encrypted: PusherEncryptedPrivateChannel;
        presence: PusherPresenceChannel;
    };
    'socket.io': {
        connector: SocketIoConnector;
        public: SocketIoChannel;
        private: SocketIoPrivateChannel;
        encrypted: never;
        presence: SocketIoPresenceChannel;
    };
    null: {
        connector: NullConnector;
        public: NullChannel;
        private: NullPrivateChannel;
        encrypted: NullEncryptedPrivateChannel;
        presence: NullPresenceChannel;
    };
    function: {
        connector: any;
        public: any;
        private: any;
        encrypted: any;
        presence: any;
    };
};

type Constructor<T = {}> = new (...args: any[]) => T;

type EchoOptions<T extends keyof Broadcaster> = {
    /**
     * The broadcast connector.
     */
    broadcaster: T extends 'function' ? Constructor<InstanceType<Broadcaster[T]['connector']>> : T;

    [key: string]: any;
};
