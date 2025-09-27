"use client";

import { useCallback, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { Abi, Hex } from "viem";
import { BaseError } from "viem";

function Page() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [abiText, setAbiText] = useState<string>("");
  const [bytecodeText, setBytecodeText] = useState<string>("");
  const [argsText, setArgsText] = useState<string>("[]");
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<`0x${string}` | "">("");
  const [contractAddress, setContractAddress] = useState<`0x${string}` | "">(
    ""
  );

  const parsedAbi = useMemo(() => {
    if (!abiText.trim()) return null;
    try {
      return JSON.parse(abiText) as Abi;
    } catch {
      return null;
    }
  }, [abiText]);

  const parsedArgs = useMemo(() => {
    if (!argsText.trim()) return [] as unknown[];
    try {
      const maybe = JSON.parse(argsText);
      return Array.isArray(maybe) ? (maybe as unknown[]) : [];
    } catch {
      return [] as unknown[];
    }
  }, [argsText]);

  const normalizeBytecode = (value: string): Hex | "" => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
  };

  const handleArtifactFile = useCallback(async (file: File) => {
    setError("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Common layouts: Hardhat/Truffle: json.abi, json.bytecode
      // solc standard JSON: json.abi, json.evm.bytecode.object
      const abi = json.abi ? JSON.stringify(json.abi, null, 2) : "";
      // bytecode can be string at json.bytecode OR object at json.bytecode.object OR json.evm.bytecode.object
      let bytecode: string = "";
      if (typeof json.bytecode === "string") {
        bytecode = json.bytecode;
      } else if (json.bytecode?.object) {
        bytecode = json.bytecode.object;
      } else if (json.evm?.bytecode?.object) {
        bytecode = json.evm.bytecode.object;
      }
      if (abi) setAbiText(abi);
      if (bytecode) setBytecodeText(String(bytecode));
      // Try to preload constructor args if present in artifact
      const argsCandidate =
        json.constructorArguments ?? json.args ?? json.parameters ?? null;
      if (argsCandidate) {
        try {
          setArgsText(JSON.stringify(argsCandidate, null, 2));
        } catch {
          // ignore if not serializable
        }
      }
      if (!abi && !bytecode) {
        setError("Could not find ABI/bytecode in artifact JSON.");
      }
    } catch (e) {
      setError("Failed to parse artifact JSON.");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === "application/json") {
        void handleArtifactFile(file);
      } else {
        setError("Please drop a .json artifact file.");
      }
    },
    [handleArtifactFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleArtifactFile(file);
    },
    [handleArtifactFile]
  );

  const canDeploy = useMemo(() => {
    return (
      isConnected &&
      !!walletClient &&
      !!publicClient &&
      !!parsedAbi &&
      !!normalizeBytecode(bytecodeText)
    );
  }, [isConnected, walletClient, publicClient, parsedAbi, bytecodeText]);

  const handleDeploy = useCallback(async () => {
    setError("");
    setTxHash("");
    setContractAddress("");
    if (!walletClient || !publicClient) {
      setError("Wallet/public client not available.");
      return;
    }
    if (!parsedAbi) {
      setError("Invalid ABI JSON.");
      return;
    }
    // Validate constructor args count if constructor exists
    try {
      const constructorFragment = (parsedAbi as Abi).find(
        (item) => (item as any).type === "constructor"
      ) as any | undefined;
      const requiredArgs = constructorFragment?.inputs?.length ?? 0;
      if (requiredArgs !== (parsedArgs?.length ?? 0)) {
        setError(
          `Constructor expects ${requiredArgs} arg(s), but received ${
            parsedArgs?.length ?? 0
          }.`
        );
        return;
      }
    } catch {}
    const bytecode = normalizeBytecode(bytecodeText);
    if (!bytecode) {
      setError("Bytecode is required.");
      return;
    }
    const hexBytecode: Hex = bytecode;
    setIsDeploying(true);
    try {
      const hash = await walletClient.deployContract({
        abi: parsedAbi,
        bytecode: hexBytecode,
        args: parsedArgs as unknown[],
        account: address,
      });
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.contractAddress) setContractAddress(receipt.contractAddress);
    } catch (e: unknown) {
      const message =
        e instanceof BaseError
          ? e.shortMessage || e.message
          : e instanceof Error
          ? e.message
          : String(e);
      setError(message || "Deployment failed.");
    } finally {
      setIsDeploying(false);
    }
  }, [walletClient, publicClient, parsedAbi, bytecodeText, parsedArgs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: 12,
        }}
      >
        <ConnectButton />
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <h2 style={{ marginBottom: 8 }}>Deploy Smart Contract</h2>
        <p style={{ color: "#555", marginBottom: 16 }}>
          Upload an artifact JSON to auto-fill, or paste ABI and bytecode.
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            border: "1px dashed #999",
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
            background: "#fafafa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="file"
              accept="application/json"
              onChange={onFileChange}
            />
            <span style={{ color: "#666" }}>
              or drag & drop artifact.json here
            </span>
          </div>
        </div>

        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          ABI (JSON)
        </label>
        <textarea
          value={abiText}
          onChange={(e) => setAbiText(e.target.value)}
          placeholder='[ { "type": "constructor", ... }, { "name": "mint", ... } ]'
          rows={10}
          style={{
            width: "100%",
            fontFamily: "monospace",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ddd",
            marginBottom: 12,
          }}
        />

        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Bytecode (0x...)
        </label>
        <textarea
          value={bytecodeText}
          onChange={(e) => setBytecodeText(e.target.value)}
          placeholder="0x600..."
          rows={4}
          style={{
            width: "100%",
            fontFamily: "monospace",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ddd",
            marginBottom: 12,
          }}
        />

        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Constructor args (JSON array)
        </label>
        <input
          value={argsText}
          onChange={(e) => setArgsText(e.target.value)}
          placeholder="[]"
          style={{
            width: "100%",
            fontFamily: "monospace",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ddd",
            marginBottom: 12,
          }}
        />

        {error ? (
          <div style={{ color: "#b00020", marginBottom: 12 }}>{error}</div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => void handleDeploy()}
            disabled={!canDeploy || isDeploying}
            style={{
              background: canDeploy && !isDeploying ? "#111" : "#999",
              color: "#fff",
              padding: "10px 16px",
              border: "none",
              borderRadius: 6,
              cursor: canDeploy && !isDeploying ? "pointer" : "not-allowed",
            }}
          >
            {isDeploying ? "Deploying..." : "Deploy"}
          </button>
          {address ? (
            <span style={{ color: "#555" }}>Using wallet: {address}</span>
          ) : (
            <span style={{ color: "#555" }}>Connect a wallet to deploy</span>
          )}
        </div>

        {txHash ? (
          <div style={{ marginTop: 16 }}>
            <div>
              <strong>Tx hash:</strong> {txHash}
            </div>
            {contractAddress ? (
              <div>
                <strong>Deployed at:</strong> {contractAddress}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Page;