import * as vscode from 'vscode';
import { TranscriptionProvider } from './transcriptionProvider';
import { ElevenLabsService } from './elevenLabsService';
import { GoogleSpeechService } from './googleSpeechService';

/**
 * One transcription backend, described in data so the rest of the extension
 * never branches on provider id.
 *
 * To add a provider:
 *   1. Implement `TranscriptionProvider` in its own `src/<name>Service.ts`.
 *   2. Append one `ProviderDescriptor` to `PROVIDERS` below.
 *   3. Add its id to the `voiceScribe.provider` enum and any provider-specific
 *      settings in package.json.
 * No other file needs to change — init, the picker, credential setup, and the
 * not-configured guard all read from this registry.
 */
export interface ProviderDescriptor {
    /** Stable id stored in `voiceScribe.provider` (e.g. 'google'). */
    id: string;
    /** Quick-pick label (may include a `$(icon)` codicon). */
    label: string;
    /** Quick-pick description shown when this provider is not the current one. */
    detail: string;
    /**
     * Build the provider from current settings. Return `null` when required
     * credentials/config are missing (e.g. no API key) — callers treat that as
     * "chosen but not set up yet".
     */
    create(config: vscode.WorkspaceConfiguration): TranscriptionProvider | null;
    /** Walk the user through setting up credentials for this provider. */
    configure(config: vscode.WorkspaceConfiguration): Promise<void>;
    /** One-line hint shown when the provider is selected but `create()` returns null. */
    setupHint: string;
}

export const DEFAULT_PROVIDER = 'elevenlabs';

export const PROVIDERS: ProviderDescriptor[] = [
    {
        id: 'elevenlabs',
        label: '$(broadcast) ElevenLabs — Scribe v2 Realtime',
        detail: 'requires API key',
        create: (config) => {
            const apiKey = config.get<string>('apiKey');
            return apiKey ? new ElevenLabsService(apiKey) : null;
        },
        configure: async (config) => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your ElevenLabs API key',
                password: true,
                placeHolder: 'xi_xxxxxxxxxxxxxxxx',
            });
            if (apiKey) {
                await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('✅ ElevenLabs API key saved');
            }
        },
        setupHint: 'Run "Voice Scribe: Configure API Key" to add your ElevenLabs key.',
    },
    {
        id: 'google',
        label: '$(cloud) Google Cloud — Chirp 3 streaming',
        detail: 'uses gcloud ADC · no API key',
        // Google uses Application Default Credentials; nothing to gate on at
        // construction time, so this always returns a service.
        create: (config) => new GoogleSpeechService({
            project: config.get<string>('googleProject') || undefined,
            location: config.get<string>('googleLocation', 'eu'),
            model: config.get<string>('googleModel', 'chirp_3'),
        }),
        configure: async () => {
            vscode.window.showInformationMessage(
                'The Google provider uses gcloud Application Default Credentials — no API key needed. ' +
                'Run "gcloud auth application-default login" in a terminal.',
            );
        },
        setupHint: 'Run "gcloud auth application-default login" to authenticate.',
    },
];

/** Look up a descriptor by id, falling back to the default provider. */
export function getProvider(id: string): ProviderDescriptor {
    return PROVIDERS.find((p) => p.id === id)
        ?? PROVIDERS.find((p) => p.id === DEFAULT_PROVIDER)!;
}
