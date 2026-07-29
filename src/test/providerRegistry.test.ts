/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { createMockVscode } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('providerRegistry', () => {
    let registry: any;
    let mockVscode: any;
    let elInstance: any;
    let gInstance: any;
    let ElevenLabsCtor: sinon.SinonStub;
    let GoogleCtor: sinon.SinonStub;

    beforeEach(() => {
        mockVscode = createMockVscode();
        elInstance = { __kind: 'elevenlabs' };
        gInstance = { __kind: 'google' };
        ElevenLabsCtor = sinon.stub().returns(elInstance);
        GoogleCtor = sinon.stub().returns(gInstance);

        registry = proxyquire('../providerRegistry', {
            'vscode': mockVscode,
            './elevenLabsService': { ElevenLabsService: ElevenLabsCtor },
            './googleSpeechService': { GoogleSpeechService: GoogleCtor },
        });
    });

    afterEach(() => sinon.restore());

    const config = () => mockVscode.workspace.getConfiguration('voiceScribe');

    // ── registry shape (the extensibility contract) ────────────────────
    it('registers elevenlabs and google with the full descriptor shape', () => {
        const ids = registry.PROVIDERS.map((p: any) => p.id);
        assert.deepStrictEqual(ids.sort(), ['elevenlabs', 'google']);
        for (const p of registry.PROVIDERS) {
            for (const field of ['id', 'label', 'detail', 'create', 'isConfigured', 'configure', 'setupHint']) {
                assert.ok(p[field] !== undefined, `${p.id} missing ${field}`);
            }
        }
    });

    it('getProvider falls back to the default for unknown ids', () => {
        assert.strictEqual(registry.getProvider('google').id, 'google');
        assert.strictEqual(registry.getProvider('does-not-exist').id, registry.DEFAULT_PROVIDER);
    });

    // ── create() gating ────────────────────────────────────────────────
    it('elevenlabs.create returns null without an API key, an instance with one', () => {
        const el = registry.getProvider('elevenlabs');
        assert.strictEqual(el.create(config()), null);

        mockVscode._configValues.set('apiKey', 'xi_key');
        assert.strictEqual(el.create(config()), elInstance);
        sinon.assert.calledWith(ElevenLabsCtor, 'xi_key');
    });

    it('google.create always builds a service from settings (ADC, no key)', () => {
        mockVscode._configValues.set('googleProject', 'proj-x');
        mockVscode._configValues.set('googleLocation', 'us-central1');
        mockVscode._configValues.set('googleModel', 'chirp_3');

        const g = registry.getProvider('google');
        assert.strictEqual(g.create(config()), gInstance);
        sinon.assert.calledWithMatch(GoogleCtor, {
            project: 'proj-x', location: 'us-central1', model: 'chirp_3',
        });
    });

    it('checks setup without constructing a disposable provider', () => {
        const elevenlabs = registry.getProvider('elevenlabs');
        const google = registry.getProvider('google');

        assert.strictEqual(elevenlabs.isConfigured(config()), false);
        mockVscode._configValues.set('apiKey', 'xi_key');
        assert.strictEqual(elevenlabs.isConfigured(config()), true);
        assert.strictEqual(google.isConfigured(config()), true);
        sinon.assert.notCalled(ElevenLabsCtor);
        sinon.assert.notCalled(GoogleCtor);
    });

    it('google.create defaults location=eu, model=long, project=undefined', () => {
        registry.getProvider('google').create(config());
        sinon.assert.calledWithMatch(GoogleCtor, { location: 'eu', model: 'long', project: undefined });
    });

    // ── configure() ────────────────────────────────────────────────────
    it('elevenlabs.configure prompts for a key and saves it', async () => {
        mockVscode.window.showInputBox.resolves('xi_typed');
        await registry.getProvider('elevenlabs').configure(config());
        sinon.assert.calledWith(mockVscode._config.update, 'apiKey', 'xi_typed', mockVscode.ConfigurationTarget.Global);
    });

    it('google.configure shows ADC guidance and never prompts for a key', async () => {
        await registry.getProvider('google').configure(config());
        sinon.assert.notCalled(mockVscode.window.showInputBox);
        sinon.assert.called(mockVscode.window.showInformationMessage);
    });
});
