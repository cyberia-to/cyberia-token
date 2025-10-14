import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";

interface ZodiacRole {
  key: string;
  name: string;
  description: string;
  members: string[];
  targets: any[];
}

interface ZodiacConfig {
  version: string;
  chainId: string;
  meta: {
    name: string;
    description: string;
    txBuilderVersion: string;
  };
  createdAt: number;
  roles: ZodiacRole[];
  scopeConfig: any;
}

const TEMPLATE_VARIABLES = ["{{TREASURY_SAFE_ADDRESS}}", "{{CAP_TOKEN_ADDRESS}}", "{{ARAGON_DAO_ADDRESS}}"];

function validateZodiacConfig(configPath: string): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if file exists
  if (!fs.existsSync(configPath)) {
    errors.push(`Configuration file not found: ${configPath}`);
    return { valid: false, errors, warnings };
  }

  // Read and parse the config
  let config: ZodiacConfig;
  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(configContent);
  } catch (error) {
    errors.push(`Failed to parse configuration file: ${error}`);
    return { valid: false, errors, warnings };
  }

  // Check for template variables
  const configString = JSON.stringify(config);
  const foundTemplateVars: string[] = [];

  for (const templateVar of TEMPLATE_VARIABLES) {
    if (configString.includes(templateVar)) {
      foundTemplateVars.push(templateVar);
    }
  }

  if (foundTemplateVars.length > 0) {
    errors.push(`Configuration contains unreplaced template variables: ${foundTemplateVars.join(", ")}`);
    errors.push("Please replace these with actual addresses before deployment.");
  }

  // Validate structure
  if (!config.version) {
    warnings.push("Missing version field");
  }

  if (!config.chainId) {
    errors.push("Missing chainId field");
  }

  if (!config.roles || !Array.isArray(config.roles)) {
    errors.push("Missing or invalid roles array");
    return { valid: false, errors, warnings };
  }

  // Validate each role
  config.roles.forEach((role, index) => {
    if (!role.key) {
      errors.push(`Role ${index} missing 'key' field`);
    }

    if (!role.name) {
      errors.push(`Role ${index} missing 'name' field`);
    }

    if (!role.members || !Array.isArray(role.members)) {
      errors.push(`Role ${index} (${role.name || "unknown"}) missing or invalid 'members' array`);
    } else {
      // Validate member addresses
      role.members.forEach((member, memberIndex) => {
        if (!member.startsWith("{{") && !member.endsWith("}}")) {
          try {
            ethers.getAddress(member);
          } catch {
            errors.push(
              `Role ${index} (${role.name || "unknown"}) member ${memberIndex} has invalid address: ${member}`
            );
          }
        }
      });
    }

    if (!role.targets || !Array.isArray(role.targets)) {
      errors.push(`Role ${index} (${role.name || "unknown"}) missing or invalid 'targets' array`);
    } else {
      // Validate target addresses
      role.targets.forEach((target, targetIndex) => {
        if (target.address && !target.address.startsWith("{{") && !target.address.endsWith("}}")) {
          try {
            ethers.getAddress(target.address);
          } catch {
            errors.push(
              `Role ${index} (${role.name || "unknown"}) target ${targetIndex} has invalid address: ${target.address}`
            );
          }
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function printResults(result: { valid: boolean; errors: string[]; warnings: string[] }) {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║         ZODIAC ROLES CONFIGURATION VALIDATION                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  if (result.errors.length > 0) {
    console.log("❌ ERRORS:");
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log("⚠️  WARNINGS:");
    result.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
    console.log();
  }

  if (result.valid) {
    console.log("✅ VALIDATION PASSED");
    console.log("   Configuration is valid and ready for deployment.\n");
  } else {
    console.log("❌ VALIDATION FAILED");
    console.log("   Please fix the errors above before proceeding.\n");
    process.exitCode = 1;
  }
}

async function main() {
  const configPath = process.env.ZODIAC_CONFIG_PATH || path.join(__dirname, "..", "docs", "zodiac-roles-config.json");

  console.log(`📄 Validating configuration file: ${configPath}\n`);

  const result = validateZodiacConfig(configPath);
  printResults(result);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exitCode = 1;
});
