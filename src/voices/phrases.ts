export interface VoicePhraseDef {
  id: string;
  label: string;
  hint: string;
  tts: string;
}

/** Built-in phrases users can record. */
export const BUILTIN_VOICE_PHRASES: VoicePhraseDef[] = [
  { id: "countdown-5", label: "Cinco", hint: "Cuenta atrás", tts: "cinco" },
  { id: "countdown-4", label: "Cuatro", hint: "Cuenta atrás", tts: "cuatro" },
  { id: "countdown-3", label: "Tres", hint: "Cuenta atrás", tts: "tres" },
  { id: "countdown-2", label: "Dos", hint: "Cuenta atrás", tts: "dos" },
  { id: "countdown-1", label: "Uno", hint: "Cuenta atrás", tts: "uno" },
  { id: "prepare", label: "¿Listos?", hint: "Preparación", tts: "¿Listos?" },
  { id: "work", label: "¡Vamos!", hint: "Trabajo", tts: "¡Vamos!" },
  { id: "rest", label: "Recupera", hint: "Descanso", tts: "Recupera" },
  { id: "finish", label: "Terminado", hint: "Fin del entreno", tts: "Terminado" }
];

export function countdownPhraseId(seconds: number): string {
  return `countdown-${seconds}`;
}

export function exercisePhraseId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `exercise:${slug || "ejercicio"}`;
}

export function phraseForStepKind(kind: string): string {
  if (kind === "prepare") return "prepare";
  if (kind === "work") return "work";
  if (kind === "rest" || kind === "restBetweenSets") return "rest";
  if (kind === "cooldown") return "cooldown";
  return "work";
}
