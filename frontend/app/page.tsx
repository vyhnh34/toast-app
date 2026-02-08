"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LiveKitRoom,
    useVoiceAssistant,
    RoomAudioRenderer,
    useRoomContext,
    useConnectionState,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { ConnectionState } from "livekit-client";
import Toaster from "../components/Toaster";

// Type declarations for Web Speech API
interface ISpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onresult: ((event: ISpeechRecognitionEvent) => void) | null;
    onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}

interface ISpeechRecognitionEvent {
    results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionResultList {
    length: number;
    [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionResult {
    [index: number]: { transcript: string };
    isFinal: boolean;
}

interface ISpeechRecognitionErrorEvent {
    error: string;
}

declare global {
    interface Window {
        SpeechRecognition: new () => ISpeechRecognition;
        webkitSpeechRecognition: new () => ISpeechRecognition;
    }
}

const BACKGROUND_STYLE = { background: "linear-gradient(180deg, #F5F5F5 0%, #E8E8E8 100%)" };

async function getConnectionToken(): Promise<{ accessToken: string; roomName: string }> {
    const response = await fetch("/api/token");
    const data = await response.json();
    return data;
}

// Dummy past chat sessions
const PAST_CHATS = [
    { id: 1, title: "ZoomRide - Ride Sharing App", persona: "Boomer Dad", date: "Today" },
    { id: 2, title: "MealPrep AI - Recipe Generator", persona: "Gen Z Intern", date: "Today" },
    { id: 3, title: "CryptoWallet Pro", persona: "The VC Bro", date: "Yesterday" },
    { id: 4, title: "FitTrack - Workout Planner", persona: "Stressed Mom", date: "Yesterday" },
    { id: 5, title: "StudyBuddy - Homework Helper", persona: "The Engineer", date: "Feb 6" },
    { id: 6, title: "PetCare - Vet Appointments", persona: "Boomer Dad", date: "Feb 5" },
    { id: 7, title: "GroceryGo - Shopping List", persona: "Stressed Mom", date: "Feb 5" },
];

// Sidebar for chat history
function Sidebar({ isOpen, onClose, currentChat }: {
    isOpen: boolean;
    onClose: () => void;
    currentChat?: Array<{ role: string; text: string }>;
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black z-40"
                        onClick={onClose}
                    />
                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-80 bg-neutral-900 shadow-xl z-50 p-6"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-white">Chats</h2>
                            <button onClick={onClose} className="p-2 hover:opacity-70 text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
                            {PAST_CHATS.map((chat, i) => (
                                <button
                                    key={chat.id}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${i === 0
                                        ? "bg-neutral-700 text-white"
                                        : "hover:bg-neutral-800 text-gray-300"
                                        }`}
                                >
                                    <p className="text-sm font-medium truncate">{chat.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{chat.persona} · {chat.date}</p>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function VoiceAssistantUI({ onDisconnect }: { onDisconnect: () => void }) {
    const voiceAssistant = useVoiceAssistant();
    const connectionState = useConnectionState();
    const room = useRoomContext();

    const state = voiceAssistant.state;
    const agentTranscriptions = voiceAssistant.agentTranscriptions;

    const isSpeaking = state === "speaking";
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Get the most recent transcription text
    const displayText = useMemo(() => {
        let text = "";

        if (agentTranscriptions && agentTranscriptions.length > 0) {
            const lastSegment = agentTranscriptions[agentTranscriptions.length - 1];
            if (lastSegment?.text) {
                text = lastSegment.text;
            }
        }

        if (!text) {
            if (connectionState !== ConnectionState.Connected) {
                return "Connecting...";
            }
            if (state === "speaking") return "Speaking...";
            if (state === "listening") return "Listening...";
            if (state === "thinking") return "Thinking...";
            return "Say something...";
        }

        // Limit text to approximately 80 characters (roughly 2-3 lines)
        if (text.length > 100) {
            text = "..." + text.slice(-97);
        }

        return text;
    }, [state, connectionState, agentTranscriptions]);

    const handleStop = useCallback(() => {
        room.disconnect();
        onDisconnect();
    }, [room, onDisconnect]);

    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen px-4 relative"
            style={BACKGROUND_STYLE}
        >
            {/* Hamburger Menu */}
            <button
                onClick={() => setSidebarOpen(true)}
                className="absolute top-6 right-6 p-2 hover:opacity-70 transition-opacity"
            >
                <Menu size={32} strokeWidth={2.5} color="#8B6914" />
            </button>

            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Live Transcript Box with fade gradient */}
            <div className="w-full max-w-md px-4 mb-8 relative">
                <div
                    className="absolute inset-x-0 top-0 h-8 pointer-events-none z-10"
                    style={{ background: "linear-gradient(to bottom, #F5F5F5, transparent)" }}
                />
                <p className="text-xl font-semibold text-black text-center leading-relaxed max-h-24 overflow-hidden">
                    {displayText}
                </p>
            </div>

            {/* Toaster SVG */}
            <div className="w-64 md:w-80 mb-4">
                <Toaster isSpeaking={isSpeaking} />
            </div>

            {/* Stop Button */}
            <button
                onClick={handleStop}
                className="mt-8 px-12 py-3 rounded-full font-semibold text-lg transition-colors hover:opacity-90"
                style={{ backgroundColor: "#e7c99b", color: "#000" }}
            >
                Stop
            </button>

            <RoomAudioRenderer />
        </div>
    );
}

export default function Home() {
    const [token, setToken] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
    const [wakeWordStatus, setWakeWordStatus] = useState("");
    const isConnectingRef = useRef(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const recognitionRef = useRef<ISpeechRecognition | null>(null);

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

    const handleConnect = useCallback(async () => {
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;
        setIsConnecting(true);
        setIsListeningForWakeWord(false);

        // Stop wake word recognition
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        try {
            const { accessToken } = await getConnectionToken();
            setToken(accessToken);
        } catch (error) {
            console.error("Failed to connect:", error);
            isConnectingRef.current = false;
            setIsConnecting(false);
        }
    }, []);

    const handleDisconnect = useCallback(() => {
        setToken(null);
        setIsConnecting(false);
        isConnectingRef.current = false;
    }, []);

    // Wake word detection
    const startWakeWordListening = useCallback(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log("Speech recognition not supported");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsListeningForWakeWord(true);
            setWakeWordStatus("Listening for 'Hey Toast'...");
        };

        recognition.onresult = (event: ISpeechRecognitionEvent) => {
            const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i])
                .map(result => result[0].transcript)
                .join(' ')
                .toLowerCase();

            // Check for wake word
            if (transcript.includes('hey toast') ||
                transcript.includes('hey toes') ||
                transcript.includes('a toast') ||
                transcript.includes('hey tost')) {
                setWakeWordStatus("Wake word detected! Connecting...");
                handleConnect();
            }
        };

        recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
            console.log("Speech recognition error:", event.error);
            if (event.error === 'no-speech') {
                // Restart if no speech detected
                recognition.stop();
                setTimeout(() => {
                    if (!isConnectingRef.current && !token) {
                        recognition.start();
                    }
                }, 100);
            }
        };

        recognition.onend = () => {
            // Restart if not connected yet
            if (!isConnectingRef.current && !token) {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("Could not restart recognition");
                    }
                }, 100);
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.log("Could not start recognition:", e);
        }
    }, [handleConnect, token]);

    // Start listening when component mounts
    useEffect(() => {
        if (!token && !isConnecting) {
            startWakeWordListening();
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [token, isConnecting, startWakeWordListening]);

    if (!token) {
        return (
            <main
                className="min-h-screen flex flex-col items-center justify-center px-4 relative"
                style={BACKGROUND_STYLE}
            >
                {/* Hamburger Menu */}
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="absolute top-6 right-6 p-2 hover:opacity-70 transition-opacity"
                >
                    <Menu size={32} strokeWidth={2.5} color="#8B6914" />
                </button>

                {/* Sidebar with past conversations */}
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />

                <p className="text-xl font-semibold text-black text-center mb-8">
                    Hello, I&apos;m Toast
                </p>

                <div className="w-64 md:w-80 mb-8">
                    <Toaster isSpeaking={false} />
                </div>

                {/* Wake word status */}
                {isListeningForWakeWord && (
                    <p className="text-sm text-gray-500 mb-4 animate-pulse">
                        {wakeWordStatus || "Say 'Hey Toast' to start"}
                    </p>
                )}

                <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="px-12 py-3 rounded-full border-2 border-gray-400 text-black font-semibold text-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                    {isConnecting ? "Connecting..." : "Start"}
                </button>

                <p className="text-xs text-gray-400 mt-4">
                    or say &quot;Hey Toast&quot;
                </p>
            </main>
        );
    }

    return (
        <LiveKitRoom
            token={token}
            serverUrl={livekitUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={handleDisconnect}
        >
            <VoiceAssistantUI onDisconnect={handleDisconnect} />
        </LiveKitRoom>
    );
}

