/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import dns from "dns";
import dnsPromisesDirect from "dns/promises";

const dnsPromises = dns.promises;

// Only patch once
if (!(dns as any).__verdant_patched__) {
  (dns as any).__verdant_patched__ = true;

  try {
    // Set DNS servers globally on default resolvers
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    if (dnsPromisesDirect && (dnsPromisesDirect as any).setServers) {
      try {
        (dnsPromisesDirect as any).setServers(["8.8.8.8", "1.1.1.1"]);
      } catch (err) {}
    }

    const customCallbackResolver = new dns.Resolver();
    customCallbackResolver.setServers(["8.8.8.8", "1.1.1.1"]);

    (dns as any).resolveSrv = function (hostname: string, callback: any) {
      return customCallbackResolver.resolveSrv(hostname, callback);
    };

    (dns as any).resolveTxt = function (hostname: string, callback: any) {
      return customCallbackResolver.resolveTxt(hostname, callback);
    };

    if (dnsPromises || dnsPromisesDirect) {
      // Use the promise resolver class
      const resolverClass = dnsPromises ? dnsPromises.Resolver : (dnsPromisesDirect as any).Resolver;
      const customPromiseResolver = new resolverClass();
      customPromiseResolver.setServers(["8.8.8.8", "1.1.1.1"]);

      const patchObject = (obj: any) => {
        if (!obj) return;
        obj.resolveSrv = function (hostname: string) {
          return customPromiseResolver.resolveSrv(hostname);
        };
        obj.resolveTxt = function (hostname: string) {
          return customPromiseResolver.resolveTxt(hostname);
        };
      };

      patchObject(dnsPromises);
      patchObject(dnsPromisesDirect);
    }
    console.log("Verdant DNS patch applied successfully to resolve MongoDB Atlas SRV/TXT records.");
  } catch (e) {
    console.warn("Failed to apply Verdant DNS patch:", e);
  }
}
