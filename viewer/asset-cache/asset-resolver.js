(function (global) {
  'use strict';
  class SpawnbornAssetResolver {
    constructor(manifest, options) {
      if (!manifest) throw new Error('AssetResolver requires a manifest.');
      this.manifest = manifest;
      this.basePath = String((options && options.basePath) || '');
      this.exact = new Map();
      this.folded = new Map();
      const packages = manifest.packages || (manifest.textures ? { [manifest.package || 'package']: manifest } : {});
      for (const packageManifest of Object.values(packages)) {
        for (const [objectName, entry] of Object.entries(packageManifest.textures || {})) {
          const source = entry.source || `${packageManifest.package}.${objectName}`;
          const record = { ...entry, objectName, source, package: packageManifest.package };
          this.exact.set(source, record);
          this.folded.set(source.toLowerCase(), record);
        }
      }
    }
    _browserPath(file) {
      const value = String(file);
      if (/^(?:data:|blob:|https?:|file:)/i.test(value) || value.startsWith('/image-to-unreal-map/')) return value;
      if (!this.basePath) return value;
      return `${this.basePath.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
    }
    resolveTextureEntry(reference) {
      if (!reference) return null;
      const ref = String(reference);
      let record = this.exact.get(ref), match = 'exact';
      if (!record) { record = this.folded.get(ref.toLowerCase()); match = 'case-insensitive'; }
      return record ? { ...record, match, browserPath: this._browserPath(record.file) } : null;
    }
    resolveTexture(reference) { const e=this.resolveTextureEntry(reference); return e ? e.browserPath : null; }
    hasTexture(reference) { return !!this.resolveTextureEntry(reference); }
    listPackages() { return [...new Set([...this.exact.values()].map(v => v.package))]; }
  }
  global.SpawnbornAssetResolver = SpawnbornAssetResolver;
})(typeof window !== 'undefined' ? window : globalThis);
