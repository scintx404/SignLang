export interface ScriptEntry {
  glosses: string[]
  text: string
}

/** Signer -> spoken English (coral mode) */
export const SIGN_SCRIPT: ScriptEntry[] = [
  { glosses: ["HELLO", "NICE", "MEET-YOU"], text: "Hi there, really nice to finally meet you." },
  { glosses: ["HELP", "ME", "FIND"], text: "Could you help me find the right platform?" },
  { glosses: ["TRAIN", "DOWNTOWN", "WHICH"], text: "Which train actually goes downtown?" },
  { glosses: ["THANK-YOU", "KIND"], text: "Thank you so much, that's really kind of you." },
  { glosses: ["SEE-YOU", "LATER"], text: "See you later, take care!" },
]

/** Spoken English -> signs (violet mode) */
export const VOICE_SCRIPT: ScriptEntry[] = [
  { glosses: ["SURE", "PLATFORM", "DOWN-HALL"], text: "Sure, the platform is right down the hall on your left." },
  { glosses: ["BLUE-LINE", "GO", "DOWNTOWN"], text: "The blue line will take you straight downtown." },
  { glosses: ["ABOUT", "TEN", "MINUTES"], text: "It's about a ten minute ride from here." },
  { glosses: ["YOU", "WELCOME"], text: "You're very welcome, happy to help." },
  { glosses: ["SAFE", "TRAVELS"], text: "Have a great trip and safe travels!" },
]

/* ------------------------------------------------------------------ *
 * MediaPipe-style 21-landmark hand model (wrist at origin, points up)
 * ------------------------------------------------------------------ */
export const HAND_BASE: [number, number][] = [
  [0, 0],
  [-0.12, -0.08],
  [-0.22, -0.18],
  [-0.3, -0.28],
  [-0.36, -0.37],
  [-0.08, -0.42],
  [-0.1, -0.6],
  [-0.11, -0.72],
  [-0.12, -0.82],
  [0.02, -0.44],
  [0.02, -0.64],
  [0.02, -0.77],
  [0.02, -0.88],
  [0.12, -0.42],
  [0.14, -0.6],
  [0.15, -0.72],
  [0.16, -0.82],
  [0.2, -0.36],
  [0.24, -0.5],
  [0.26, -0.6],
  [0.28, -0.68],
]

export const HAND_FINGERS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
]

export const HAND_MCP = [1, 5, 9, 13, 17]

export const HAND_CONNS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

export const FINGER_TIPS = [4, 8, 12, 16, 20]
