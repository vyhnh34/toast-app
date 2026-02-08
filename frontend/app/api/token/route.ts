import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function GET() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
        return NextResponse.json(
            { error: "LiveKit credentials not configured" },
            { status: 500 }
        );
    }

    // Convert wss:// to https:// for API calls
    const httpUrl = wsUrl.replace("wss://", "https://");

    // Generate a random room name and identity
    const roomName = `toast-room-${Date.now()}`;
    const identity = `user-${Date.now()}`;

    try {
        // Create the room first
        const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
        await roomService.createRoom({ name: roomName, emptyTimeout: 60 });

        // Note: Agent in dev mode auto-joins rooms, no need to dispatch

        // Generate token for the user
        const token = new AccessToken(apiKey, apiSecret, {
            identity,
            ttl: "1h",
        });

        token.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const accessToken = await token.toJwt();

        return NextResponse.json({ accessToken, roomName });
    } catch (error) {
        console.error("Error setting up room:", error);
        return NextResponse.json(
            { error: "Failed to setup room" },
            { status: 500 }
        );
    }
}
