import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Test to catch Next.js dynamic route conflicts
 * 
 * Next.js requires that all dynamic segments in the same directory
 * use the same parameter name. For example:
 * 
 * ✅ VALID:
 * - /api/subscriptions/[subscriptionId]/pause
 * - /api/subscriptions/[subscriptionId]/cancel
 * 
 * ❌ INVALID:
 * - /api/subscriptions/[id]/pause
 * - /api/subscriptions/[subscriptionId]/cancel
 * 
 * This test prevents the "You cannot use different slug names for the same dynamic path" error
 */

describe("Route Conflicts", () => {
  it("should not have conflicting dynamic route names in the same directory", () => {
    const conflicts: string[] = [];
    
    function checkDirectory(dir: string, relativePath = "") {
      try {
        const items = readdirSync(dir);
        const dynamicRoutes: { name: string; path: string }[] = [];
        
        items.forEach((item) => {
          const fullPath = join(dir, item);
          const itemRelativePath = join(relativePath, item);
          
          if (statSync(fullPath).isDirectory()) {
            // Check if this is a dynamic route (starts with [ and ends with ])
            if (item.startsWith("[") && item.endsWith("]")) {
              dynamicRoutes.push({
                name: item.slice(1, -1), // Remove brackets
                path: itemRelativePath,
              });
            }
            
            // Recursively check subdirectories
            checkDirectory(fullPath, itemRelativePath);
          }
        });
        
        // Check if there are multiple dynamic routes with different names in the same directory
        if (dynamicRoutes.length > 1) {
          const uniqueNames = new Set(dynamicRoutes.map((r) => r.name));
          if (uniqueNames.size > 1) {
            conflicts.push(
              `Conflicting dynamic routes in ${relativePath || "root"}:\n` +
              dynamicRoutes.map((r) => `  - [${r.name}] (${r.path})`).join("\n")
            );
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read - skip
      }
    }
    
    // Check all app routes
    const appDir = join(__dirname, "../../src/app");
    checkDirectory(appDir);
    
    if (conflicts.length > 0) {
      throw new Error(
        "Found conflicting dynamic route names:\n\n" +
        conflicts.join("\n\n") +
        "\n\nAll dynamic routes in the same directory must use the same parameter name."
      );
    }
  });
});


