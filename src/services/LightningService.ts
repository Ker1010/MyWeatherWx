// ===== Blitzortung Client (Standalone) =====
class EventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, callback: Function): this {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return this;
  }

  once(event: string, callback: Function): this {
    const wrapper = (...args: any[]) => {
      callback(...args);
      this.removeListener(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach((cb) => cb(...args));
    }
  }

  removeListener(event: string, callback: Function): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  removeAllListeners(): void {
    this.events = {};
  }
}

interface SocketFactory {
  make(url: string): any;
}

interface GeoLocation {
  latitude: number;
  longitude: number;
}

const Polarity = {
  Negative: 0,
  Positive: 1,
} as const;

type Polarity = (typeof Polarity)[keyof typeof Polarity];

interface Location extends GeoLocation {
  altitude: number;
}

interface Detector {
  id: string;
  location: Location;
  status: number;
}

interface Strike {
  location: Location;
  time: Date;
  detectors?: Detector[];
  delay: number;
  deviation: number;
  polarity: Polarity;
  maxDeviation: number;
  maxCircularGap: number;
}

class NotConnectedError extends Error {
  readonly client: Client;

  constructor(client: Client) {
    super("Client is not connected");
    this.client = client;
    this.name = "NotConnectedError";
  }
}

class Client extends EventEmitter {
  private socketFactory: SocketFactory;
  private socket?: WebSocket;

  constructor(socketFactory: SocketFactory) {
    super();
    this.socketFactory = socketFactory;
  }

  getSocket(): WebSocket | undefined {
    return this.socket;
  }

  connect(url?: string): void {
    if (this.socket) {
      this.close();
    }

    const wsUrl = url || this.generateRandomConnectionUrl();
    this.socket = this.socketFactory.make(wsUrl) as WebSocket;

    this.socket.onopen = () => {
      this.emit("connect", this.socket);
      this.sendJSON({ a: 111 });
    };

    this.socket.onmessage = (event) => {
      try {
        const decoded = this.decode(event.data);
        if (decoded) {
          const parsed = JSON.parse(decoded);
          const strike = this.buildStrikeData(parsed);
          this.emit("data", strike);
        }
      } catch (err) {
        this.emit("error", err as Error);
      }
    };

    this.socket.onerror = (_err: Event) => {
      this.emit("error", new Error("WebSocket error"));
      setTimeout(() => this.connect(), 2000);
    };

    this.socket.onclose = () => {
      this.socket = undefined;
      this.emit("close");
    };
  }

  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
    this.removeAllListeners();
  }

  private buildStrikeData(data: any): Strike {
    // Data comes in two formats - handle both
    const location: Location = data.pos
      ? {
          latitude: data.pos[1] / 1e4,
          longitude: data.pos[0] / 1e4,
          altitude: data.pos[2] || 0,
        }
      : {
          latitude: data.lat,
          longitude: data.lon,
          altitude: data.alt || 0,
        };

    // Time is in microseconds, convert to milliseconds
    const time = new Date(data.time / 1000);

    const strike: Strike = {
      location,
      time,
      delay: data.delay || 0,
      deviation: data.mds || 0,
      polarity: data.pol === 1 ? Polarity.Positive : Polarity.Negative,
      maxDeviation: data.mcg || 0,
      maxCircularGap: data.cg || 0,
    };

    if (data.sig) {
      strike.detectors = data.sig.map((s: any) => ({
        id: String(s.sta),
        location: {
          latitude: s.lat,
          longitude: s.lon,
          altitude: s.alt || 0,
        },
        status: s.status,
      }));
    }

    return strike;
  }

  private decode(b: string): string {
    let a: string,
      e: { [key: number]: string } = {},
      d: string[] = b.split(""),
      c: string = d[0],
      f: string = c,
      g: string[] = [c],
      h: number = 256,
      o: number = h;

    for (let i = 1; i < d.length; i++) {
      let charCode = d[i].charCodeAt(0);
      a = h > charCode ? d[i] : e[charCode] ? e[charCode] : f + c;
      g.push(a);
      c = a.charAt(0);
      e[o] = f + c;
      o++;
      f = a;
    }

    return g.join("");
  }

  private sendJSON(data: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new NotConnectedError(this);
    }
    this.socket.send(JSON.stringify(data));
  }

  private generateRandomConnectionUrl(): string {
    const workingServers = [1, 3, 6, 7, 8];
    const serverId =
      workingServers[Math.floor(Math.random() * workingServers.length)];
    return `wss://ws${serverId}.blitzortung.org:443/`;
  }
}

// ===== Lightning Service =====
export interface LightningStrike {
  lat: number;
  lon: number;
  time: number;
  id: string;
}

const MALAYSIA_BOUNDS = {
  minLat: 0.5,
  maxLat: 7.5,
  minLon: 99.5,
  maxLon: 119.5,
};

function isInMalaysia(lat: number, lon: number): boolean {
  return (
    lat >= MALAYSIA_BOUNDS.minLat &&
    lat <= MALAYSIA_BOUNDS.maxLat &&
    lon >= MALAYSIA_BOUNDS.minLon &&
    lon <= MALAYSIA_BOUNDS.maxLon
  );
}

export class LightningService {
  private client: Client;
  private strikes: LightningStrike[] = [];
  private onStrikeCallback: ((strikes: LightningStrike[]) => void) | null =
    null;

  constructor() {
    this.client = new Client({
      make: (url: string) => new WebSocket(url),
    });
  }

  public connect() {
    this.client.on("data", (strike: Strike) => {
      const lat = strike.location.latitude;
      const lon = strike.location.longitude;

      // Check for valid coordinates
      if (
        typeof lat !== "number" ||
        typeof lon !== "number" ||
        isNaN(lat) ||
        isNaN(lon)
      ) {
        return;
      }

      if (!isInMalaysia(lat, lon)) return;

      const timestamp = strike.time.getTime();
      const lightningStrike: LightningStrike = {
        lat,
        lon,
        time: timestamp,
        id: `${timestamp}-${Math.random()}`,
      };

      this.strikes.push(lightningStrike);
      console.log(
        `Lightning strike in Malaysia: ${lat.toFixed(2)}, ${lon.toFixed(2)}`
      );
      this.notify();
    });

    this.client.on("connect", () => {
      console.log("Connected to Blitzortung - Monitoring Malaysia");
    });

    this.client.on("error", (err: Error) => {
      console.error("Blitzortung error:", err);
    });

    this.client.on("close", () => {
      console.log("Blitzortung connection closed");
      this.client.connect();
    });

    this.client.connect();
  }

  public onStrikesUpdate(callback: (strikes: LightningStrike[]) => void) {
    console.log("Callback registered!");
    this.onStrikeCallback = callback;
    callback([...this.strikes]); // ✓ Call immediately with existing data
  }

  public getStrikes(): LightningStrike[] {
    return [...this.strikes];
  }

  public getStrikeCount(): number {
    return this.strikes.length;
  }

  private notify() {
    console.log(
      "NOTIFY called, callback:",
      !!this.onStrikeCallback,
      "strikes:",
      this.strikes.length
    );
    if (this.onStrikeCallback) {
      console.log("Calling callback with strikes:", this.strikes);
      this.onStrikeCallback([...this.strikes]);
    } else {
      console.log("No callback registered yet!");
    }
  }

  public disconnect() {
    if (this.client) {
      this.client.close();
    }
  }
}
