"use client";

import { useState } from "react";
import Link from "next/link";
import { FaRocket, FaBolt, FaShieldAlt } from "react-icons/fa";

export default function HomePage() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    const codeText = `#!/bin/zsh

set -euo pipefail

# Usage: ./kiteup.sh <ContractName>
# Example: ./kiteup.sh SimpleStaking

if [ $# -lt 1 ]; then
  echo "Usage: $0 <ContractName>" >&2
  exit 1
fi

CONTRACT_NAME="$1"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT_DIR/out"
SRC_DIR="$ROOT_DIR/src"
FLATTEN_DIR="$ROOT_DIR/flattened"

# Base URL (override with KITE_BASE_URL env var)
BASE_URL="https://kite-app-omega.vercel.app"
UPLOAD_URL="$BASE_URL/api/upload"

# 1. Build all contracts (force rebuild to ensure artifact exists)
echo "[INFO] Building contracts..."
forge build --force >/dev/null

# 2. Find artifact JSON for the contract
echo "[INFO] Searching artifact for $CONTRACT_NAME..."
artifact_path=$(find "$OUT_DIR" -type f -name "$CONTRACT_NAME.json" | head -n1 || true)

if [ -z "$artifact_path" ]; then
  echo "[ERROR] Artifact not found for $CONTRACT_NAME after build" >&2
  exit 2
fi

echo "[INFO] Artifact path: $artifact_path"

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq is required but not installed." >&2
  exit 3
fi

# 3. Extract fields from artifact
abi=$(jq -c '.abi' "$artifact_path")
bytecode=$(jq -r '.bytecode.object // .bytecode // ""' "$artifact_path")
compiler=$(jq -r '.metadata.compiler.version // .rawMetadata.compiler.version // ""' "$artifact_path")
optimizer_enabled=$(jq -r '(.metadata.settings.optimizer.enabled // .rawMetadata.settings.optimizer.enabled // false)' "$artifact_path")
optimizer_runs=$(jq -r '(.metadata.settings.optimizer.runs // .rawMetadata.settings.optimizer.runs // 200)' "$artifact_path")
evm_version=$(jq -r '(.metadata.settings.evmVersion // .rawMetadata.settings.evmVersion // "")' "$artifact_path")
remappings=$(jq -c '(.metadata.settings.remappings // .rawMetadata.settings.remappings // [])' "$artifact_path")

# Normalize optimizer JSON
if [ "$optimizer_enabled" = "true" ] || [ "$optimizer_enabled" = "false" ]; then
  optimizer_json=$(jq -n --argjson en "$optimizer_enabled" --argjson rn "$optimizer_runs" '{enabled: $en, runs: $rn}')
else
  optimizer_json=$(jq -n --argjson en false --argjson rn 200 '{enabled: $en, runs: $rn}')
fi

# 4. Flatten contract
mkdir -p "$FLATTEN_DIR"

# Try to find source in src/ folder
source_file=$(grep -RIl --include='*.sol' --exclude-dir={node_modules,lib,out} "contract $CONTRACT_NAME\\b" "$SRC_DIR" | head -n1 || true)

if [ -z "$source_file" ]; then
  echo "[ERROR] Could not find source file for contract $CONTRACT_NAME in src/" >&2
  exit 4
fi

FLATTENED_PATH="$FLATTEN_DIR/\${CONTRACT_NAME}_flat.sol"

echo "[INFO] Flattening $CONTRACT_NAME..."
forge flatten "$source_file" -o "$FLATTENED_PATH" >/dev/null

flattened_source=$(<"$FLATTENED_PATH")

# 5. Build final JSON
echo "[INFO] Building final JSON..." >&2

response=$(
  jq -n \\
    --arg name "$CONTRACT_NAME" \\
    --arg path "$artifact_path" \\
    --arg bytecode "$bytecode" \\
    --arg compiler "$compiler" \\
    --arg sourcePath "$FLATTENED_PATH" \\
    --arg source "$flattened_source" \\
    --arg evmVersion "$evm_version" \\
    --argjson remappings "$remappings" \\
    --argjson optimizer "$optimizer_json" \\
    --argjson abi "$abi" \\
    '{
      name: $name,
      artifactPath: $path,
      compilerVersion: $compiler,
      abi: $abi,
      bytecode: $bytecode,
      flattenedSourcePath: $sourcePath,
      flattenedSource: $source,
      settings: {
        evmVersion: $evmVersion,
        remappings: $remappings,
        optimizer: $optimizer
      }
    }' | curl -sS -X POST -H "Content-Type: application/json" --data-binary @- "$UPLOAD_URL"
)

inserted_id=$(echo "$response" | jq -r '.insertedId // empty')

if [ -z "$inserted_id" ]; then
  echo "[ERROR] Upload failed or no insertedId in response" >&2
  echo "$response" >&2
  exit 5
fi

echo "$inserted_id"`;
    
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "white",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      lineHeight: "1.4"
    }}>
      {/* Header */}
      <header style={{
        background: "black",
        color: "white",
        padding: "16px 0",
        borderBottom: "4px solid black",
        position: "sticky",
        top: "0",
        zIndex: "100"
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{
            fontSize: "28px",
            fontWeight: "900",
            letterSpacing: "-0.02em"
          }}>
            ./KITE
          </div>
          <nav style={{
            display: "flex",
            gap: "16px",
            alignItems: "center"
          }}>
            <Link href="/deploy" style={{
              color: "white",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "700",
              padding: "12px 24px",
              border: "2px solid white",
              background: "black",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Deploy
            </Link>
            <Link href="/contracts" style={{
              color: "black",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "700",
              padding: "12px 24px",
              border: "2px solid black",
              background: "white",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Contracts
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: "120px 24px",
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "80px",
          alignItems: "center"
        }}>
          {/* Left Column - Text */}
                <div>
            <div style={{
              fontSize: "14px",
              fontWeight: "700",
              color: "black",
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "0.1em"
            }}>
              TOOL SUIT FOR FOUNDRY
                </div>
            
            <h1 style={{
              fontSize: "64px",
              fontWeight: "900",
              color: "black",
              margin: "0 0 32px 0",
              lineHeight: "0.9",
              letterSpacing: "-0.03em"
            }}>
            DEVELOPMENT/
              <br />
              DEPLOYMENT
              <br />
              ABSTRACTED
            </h1>
            
            <p style={{
              fontSize: "20px",
              color: "black",
              margin: "0 0 48px 0",
              fontWeight: "400",
              lineHeight: "1.4",
              maxWidth: "480px"
            }}>
              Deploy, test, and manage smart contracts with Foundry. 
              The complete toolkit for Web3 developers.
            </p>

            <div style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap"
            }}>
              <Link 
                href="/deploy"
                style={{
                  background: "black",
                  color: "white",
                  padding: "16px 32px",
                  textDecoration: "none",
                  fontSize: "16px",
                  fontWeight: "700",
                  border: "3px solid black",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "inline-block"
                }}
              >
                Start Deploying →
              </Link>
              
              <Link 
                href="/contracts"
                style={{
                  background: "white",
                  color: "black",
                  padding: "16px 32px",
                  textDecoration: "none",
                  fontSize: "16px",
                  fontWeight: "700",
                  border: "3px solid black",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "inline-block"
                }}
              >
                View Contracts
              </Link>
                </div>
              </div>

          {/* Right Column - Code Block */}
          <div style={{
            background: "black",
            color: "white",
            padding: "32px",
            border: "4px solid black",
            position: "relative"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
              paddingBottom: "16px",
              borderBottom: "1px solid white"
            }}>
              <span style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "white",
                textTransform: "lowercase",
                letterSpacing: "0.1em"
              }}>
               ./kiteup.sh
              </span>
              <button
                onClick={copyToClipboard}
                style={{
                  background: copied ? "white" : "black",
                  color: copied ? "black" : "white",
                  border: "2px solid white",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontFamily: "inherit"
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <pre style={{
              margin: "0",
              fontSize: "12px",
              color: "white",
              fontFamily: "'Fira Code', 'Monaco', 'Cascadia Code', monospace",
              lineHeight: "1.4",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "400px",
              overflowY: "auto"
            }}>
{`#!/bin/zsh

set -euo pipefail

# Usage: ./kiteup.sh <ContractName>
# Example: ./kiteup.sh SimpleStaking

if [ $# -lt 1 ]; then
  echo "Usage: $0 <ContractName>" >&2
  exit 1
fi

CONTRACT_NAME="$1"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT_DIR/out"
SRC_DIR="$ROOT_DIR/src"
FLATTEN_DIR="$ROOT_DIR/flattened"

# Base URL (override with KITE_BASE_URL env var)
BASE_URL="https://kite-app-omega.vercel.app"
UPLOAD_URL="$BASE_URL/api/upload"

# 1. Build all contracts (force rebuild to ensure artifact exists)
echo "[INFO] Building contracts..."
forge build --force >/dev/null

# 2. Find artifact JSON for the contract
echo "[INFO] Searching artifact for $CONTRACT_NAME..."
artifact_path=$(find "$OUT_DIR" -type f -name "$CONTRACT_NAME.json" | head -n1 || true)

if [ -z "$artifact_path" ]; then
  echo "[ERROR] Artifact not found for $CONTRACT_NAME after build" >&2
  exit 2
fi

echo "[INFO] Artifact path: $artifact_path"

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq is required but not installed." >&2
  exit 3
fi

# 3. Extract fields from artifact
abi=$(jq -c '.abi' "$artifact_path")
bytecode=$(jq -r '.bytecode.object // .bytecode // ""' "$artifact_path")
compiler=$(jq -r '.metadata.compiler.version // .rawMetadata.compiler.version // ""' "$artifact_path")
optimizer_enabled=$(jq -r '(.metadata.settings.optimizer.enabled // .rawMetadata.settings.optimizer.enabled // false)' "$artifact_path")
optimizer_runs=$(jq -r '(.metadata.settings.optimizer.runs // .rawMetadata.settings.optimizer.runs // 200)' "$artifact_path")
evm_version=$(jq -r '(.metadata.settings.evmVersion // .rawMetadata.settings.evmVersion // "")' "$artifact_path")
remappings=$(jq -c '(.metadata.settings.remappings // .rawMetadata.settings.remappings // [])' "$artifact_path")

# Normalize optimizer JSON
if [ "$optimizer_enabled" = "true" ] || [ "$optimizer_enabled" = "false" ]; then
  optimizer_json=$(jq -n --argjson en "$optimizer_enabled" --argjson rn "$optimizer_runs" '{enabled: $en, runs: $rn}')
else
  optimizer_json=$(jq -n --argjson en false --argjson rn 200 '{enabled: $en, runs: $rn}')
fi

# 4. Flatten contract
mkdir -p "$FLATTEN_DIR"

# Try to find source in src/ folder
source_file=$(grep -RIl --include='*.sol' --exclude-dir={node_modules,lib,out} "contract $CONTRACT_NAME\\b" "$SRC_DIR" | head -n1 || true)

if [ -z "$source_file" ]; then
  echo "[ERROR] Could not find source file for contract $CONTRACT_NAME in src/" >&2
  exit 4
fi

FLATTENED_PATH="$FLATTEN_DIR/\${CONTRACT_NAME}_flat.sol"

echo "[INFO] Flattening $CONTRACT_NAME..."
forge flatten "$source_file" -o "$FLATTENED_PATH" >/dev/null

flattened_source=$(<"$FLATTENED_PATH")

# 5. Build final JSON
echo "[INFO] Building final JSON..." >&2

response=$(
  jq -n \\
    --arg name "$CONTRACT_NAME" \\
    --arg path "$artifact_path" \\
    --arg bytecode "$bytecode" \\
    --arg compiler "$compiler" \\
    --arg sourcePath "$FLATTENED_PATH" \\
    --arg source "$flattened_source" \\
    --arg evmVersion "$evm_version" \\
    --argjson remappings "$remappings" \\
    --argjson optimizer "$optimizer_json" \\
    --argjson abi "$abi" \\
    '{
      name: $name,
      artifactPath: $path,
      compilerVersion: $compiler,
      abi: $abi,
      bytecode: $bytecode,
      flattenedSourcePath: $sourcePath,
      flattenedSource: $source,
      settings: {
        evmVersion: $evmVersion,
        remappings: $remappings,
        optimizer: $optimizer
      }
    }' | curl -sS -X POST -H "Content-Type: application/json" --data-binary @- "$UPLOAD_URL"
)

inserted_id=$(echo "$response" | jq -r '.insertedId // empty')

if [ -z "$inserted_id" ]; then
  echo "[ERROR] Upload failed or no insertedId in response" >&2
  echo "$response" >&2
  exit 5
fi

echo "$inserted_id"`}
            </pre>
                </div>
              </div>
      </section>

      {/* Stats Section */}
      <section style={{
        background: "black",
        color: "white",
        padding: "80px 24px"
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "40px",
          textAlign: "center"
        }}>
          <div>
            <div style={{
              fontSize: "48px",
              fontWeight: "900",
              marginBottom: "8px"
            }}>
              10K+
            </div>
            <div style={{
              fontSize: "14px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Contracts Deployed
              </div>
                  </div>
          <div>
            <div style={{
              fontSize: "48px",
              fontWeight: "900",
              marginBottom: "8px"
            }}>
              5K+
                </div>
            <div style={{
              fontSize: "14px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Active Developers
                </div>
              </div>
          <div>
            <div style={{
              fontSize: "48px",
              fontWeight: "900",
              marginBottom: "8px"
            }}>
              99.9%
            </div>
            <div style={{
              fontSize: "14px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Uptime
            </div>
          </div>
          <div>
            <div style={{
              fontSize: "48px",
              fontWeight: "900",
              marginBottom: "8px"
            }}>
              12
            </div>
            <div style={{
              fontSize: "14px",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}>
              Supported Chains
                </div>
                </div>
              </div>
      </section>

      {/* Disclaimer */}
      <div style={{
        background: "black",
        color: "white",
        padding: "20px 24px",
        textAlign: "center"
      }}>
        <div style={{
          fontSize: "12px",
          color: "white",
          opacity: "0.9",
          fontStyle: "italic"
        }}>
          * these numbers are fake, and kept for aesthetic purpose
        </div>
      </div>

      {/* Features Section */}
      <section style={{
        padding: "120px 24px",
        background: "white"
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto"
        }}>
          <div style={{
            textAlign: "center",
            marginBottom: "80px"
          }}>
            <h2 style={{
              fontSize: "48px",
              fontWeight: "900",
              margin: "0 0 16px 0",
              color: "black",
              letterSpacing: "-0.02em"
            }}>
              Why Choose Kite?
            </h2>
            <p style={{
              fontSize: "18px",
              color: "black",
              fontWeight: "400",
              maxWidth: "600px",
              margin: "0 auto"
            }}>
              Built for developers who demand speed, security, and simplicity.
            </p>
                  </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "40px"
          }}>
            <div style={{
              background: "white",
              color: "black",
              padding: "40px",
              border: "3px solid black",
              position: "relative"
            }}>
              <div style={{
                fontSize: "32px",
                marginBottom: "20px",
                color: "black"
              }}>
                <FaRocket />
              </div>
              <h3 style={{
                fontSize: "20px",
                fontWeight: "900",
                margin: "0 0 16px 0",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
               DEPLOY CONTRACTS
              </h3>
              <p style={{
                fontSize: "16px",
                margin: "0",
                lineHeight: "1.5",
                fontWeight: "400"
              }}>
                Deploy contracts in seconds with our optimized pipeline.
              </p>
                </div>

            <div style={{
              background: "black",
              color: "white",
              padding: "40px",
              border: "3px solid black",
              position: "relative"
            }}>
              <div style={{
                fontSize: "32px",
                marginBottom: "20px",
                color: "white"
              }}>
                <FaBolt />
              </div>
              <h3 style={{
                fontSize: "20px",
                fontWeight: "900",
                margin: "0 0 16px 0",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
               Test Contracts with EIP5792
              </h3>
              <p style={{
                fontSize: "16px",
                margin: "0",
                lineHeight: "1.5",
                fontWeight: "400"
              }}>
               Run Foundy scripts in one click with help of EIP5792 
              </p>
            </div>

            <div style={{
              background: "white",
              color: "black",
              padding: "40px",
              border: "3px solid black",
              position: "relative"
            }}>
              <div style={{
                fontSize: "32px",
                marginBottom: "20px",
                color: "black"
              }}>
                <FaShieldAlt />
              </div>
              <h3 style={{
                fontSize: "20px",
                fontWeight: "900",
                margin: "0 0 16px 0",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                Private Key Protection
              </h3>
              <p style={{
                fontSize: "16px",
                margin: "0",
                lineHeight: "1.5",
                fontWeight: "400"
              }}>
                
                Contracts deployment without exposing your Private Keys
                </p>
                  </div>
                </div>
                    </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: "120px 24px",
        background: "black",
        color: "white",
        textAlign: "center"
      }}>
        <div style={{
          maxWidth: "800px",
          margin: "0 auto"
        }}>
          <h2 style={{
            fontSize: "48px",
            fontWeight: "900",
            margin: "0 0 24px 0",
            letterSpacing: "-0.02em"
          }}>
            Ready to Build?
          </h2>
          
          <p style={{
            fontSize: "18px",
            margin: "0 0 48px 0",
            fontWeight: "400",
            opacity: "0.9"
          }}>
            Join thousands of developers deploying smart contracts with ./Kite.
          </p>

          <Link 
            href="/deploy"
            style={{
              background: "white",
              color: "black",
              padding: "20px 40px",
              textDecoration: "none",
              fontSize: "16px",
              fontWeight: "700",
              border: "3px solid white",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "inline-block"
            }}
          >
            Get Started Now →
          </Link>
                    </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: "white",
        color: "black",
        padding: "60px 24px 40px",
        borderTop: "4px solid black"
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          textAlign: "center"
        }}>
          <div style={{
            fontSize: "24px",
            fontWeight: "900",
            marginBottom: "16px",
            letterSpacing: "-0.02em"
          }}>
            ./KITE
          </div>
          <p style={{
            fontSize: "14px",
            margin: "0",
            fontWeight: "400",
            opacity: "0.7"
          }}>
            © 2025 ./Kite. All rights reserved. Built for developers, by developers.
          </p>
        </div>
      </footer>
    </div>
  );
}