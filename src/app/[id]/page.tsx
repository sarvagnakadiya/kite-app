"use client";

import { useCallback, useMemo, useState, useEffect, use } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { Abi, Hex } from "viem";
import { BaseError } from "viem";
import Link from "next/link";

interface Contract {
  _id: string;
  name?: string;
  contractName?: string;
  source: string;
  originalFormat?: string;
  uploadedAt: string;
  createdAt?: string;
  abi: Abi;
  bytecode: string;
  deployedBytecode?: string;
  compilerVersion?: string;
  artifactPath?: string;
  sourcePath?: string;
}

export default function ContractDeployPage({ params }: { params: Promise<{ id: string }> }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  const [abiText, setAbiText] = useState<string>("");
  const [bytecodeText, setBytecodeText] = useState<string>("");
  const [argsText, setArgsText] = useState<string>("[]");
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<`0x${string}` | "">("");
  const [contractAddress, setContractAddress] = useState<`0x${string}` | "">("");

  // Unwrap params
  const resolvedParams = use(params);

  // Load contract data
  useEffect(() => {
    const loadContract = async () => {
      try {
        setLoading(true);
        setError("");
        
        const response = await fetch(`/api/contracts/${resolvedParams.id}`);
        const data = await response.json();
        
        if (data.success) {
          setContract(data.contract);
          
          // Auto-fill the form
          if (data.contract.abi) {
            setAbiText(JSON.stringify(data.contract.abi, null, 2));
          }
          
          if (data.contract.bytecode) {
            setBytecodeText(data.contract.bytecode);
          }
        } else {
          setError(data.message || 'Contract not found');
        }
      } catch (err) {
        setError('Failed to load contract');
        console.error('Error loading contract:', err);
      } finally {
        setLoading(false);
      }
    };

    loadContract();
  }, [resolvedParams.id]);

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
        (item) => (item as { type?: string }).type === "constructor"
      ) as { inputs?: { length: number } } | undefined;
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
  }, [walletClient, publicClient, parsedAbi, bytecodeText, parsedArgs, address]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <div>Loading contract...</div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "50vh", padding: 32 }}>
        <h2>Contract Not Found</h2>
        <p style={{ color: "#666", marginBottom: 16 }}>{error}</p>
        <Link href="/" style={{ color: "#007bff", textDecoration: "none" }}>
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#f8f9fa",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{
        background: "white",
        borderBottom: "1px solid #e9ecef",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            marginBottom: 4, 
            fontSize: "24px",
            fontWeight: "600",
            color: "#212529"
          }}>
            Deploy {contract.name || contract.contractName}
          </h1>
          <div style={{ color: "#6c757d", fontSize: 14 }}>
            {contract.compilerVersion && `Compiler: ${contract.compilerVersion} • `}
            {contract.artifactPath && `Path: ${contract.artifactPath.split('/').pop()}`}
          </div>
        </div>
        <ConnectButton />
      </div>

      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        gap: 0,
        minHeight: "calc(100vh - 80px)"
      }}>
        {/* Left Side - Deployment */}
        <div style={{ 
          flex: 1, 
          background: "white",
          padding: "24px",
          overflow: "auto"
        }}>
          <h2 style={{ 
            margin: "0 0 24px 0", 
            fontSize: "20px", 
            fontWeight: "600",
            color: "#212529"
          }}>
            Deployment Configuration
          </h2>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: "block", 
              fontWeight: "600", 
              marginBottom: 8,
              color: "#495057",
              fontSize: "14px"
            }}>
              ABI (JSON)
            </label>
            <textarea
              value={abiText}
              onChange={(e) => setAbiText(e.target.value)}
              placeholder='[ { "type": "constructor", ... }, { "name": "mint", ... } ]'
              rows={8}
              style={{
                width: "100%",
                fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #dee2e6",
                marginBottom: 16,
                fontSize: "13px",
                lineHeight: "1.5",
                background: "#f8f9fa",
                resize: "vertical",
                minHeight: "120px"
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: "block", 
              fontWeight: "600", 
              marginBottom: 8,
              color: "#495057",
              fontSize: "14px"
            }}>
              Bytecode (0x...)
            </label>
            <textarea
              value={bytecodeText}
              onChange={(e) => setBytecodeText(e.target.value)}
              placeholder="0x600..."
              rows={4}
              style={{
                width: "100%",
                fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #dee2e6",
                marginBottom: 16,
                fontSize: "13px",
                lineHeight: "1.5",
                background: "#f8f9fa",
                resize: "vertical",
                minHeight: "80px"
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: "block", 
              fontWeight: "600", 
              marginBottom: 8,
              color: "#495057",
              fontSize: "14px"
            }}>
              Constructor Arguments (JSON array)
            </label>
            <input
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              placeholder="[]"
              style={{
                width: "100%",
                fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #dee2e6",
                marginBottom: 16,
                fontSize: "13px",
                background: "#f8f9fa"
              }}
            />
          </div>

          {error ? (
            <div style={{ 
              color: "#dc3545", 
              marginBottom: 16,
              padding: "12px",
              background: "#f8d7da",
              border: "1px solid #f5c6cb",
              borderRadius: "8px",
              fontSize: "14px"
            }}>
              {error}
            </div>
          ) : null}

          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 16,
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #dee2e6"
          }}>
            <button
              onClick={() => void handleDeploy()}
              disabled={!canDeploy || isDeploying}
              style={{
                background: canDeploy && !isDeploying ? "#28a745" : "#6c757d",
                color: "#fff",
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                cursor: canDeploy && !isDeploying ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "600",
                transition: "all 0.2s",
                minWidth: "120px"
              }}
            >
              {isDeploying ? "Deploying..." : "Deploy Contract"}
            </button>
            <div style={{ flex: 1 }}>
              {address ? (
                <div style={{ color: "#495057", fontSize: "14px" }}>
                  <strong>Wallet:</strong> {address.slice(0, 6)}...{address.slice(-4)}
                </div>
              ) : (
                <div style={{ color: "#6c757d", fontSize: "14px" }}>
                  Connect a wallet to deploy
                </div>
              )}
            </div>
          </div>

          {txHash ? (
            <div style={{ 
              marginTop: 24,
              padding: "16px",
              background: "#d4edda",
              border: "1px solid #c3e6cb",
              borderRadius: "8px"
            }}>
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#155724" }}>Transaction Hash:</strong>
                <div style={{ 
                  fontFamily: "monospace", 
                  fontSize: "12px",
                  color: "#155724",
                  wordBreak: "break-all"
                }}>
                  {txHash}
                </div>
              </div>
              {contractAddress ? (
                <div>
                  <strong style={{ color: "#155724" }}>Contract Address:</strong>
                  <div style={{ 
                    fontFamily: "monospace", 
                    fontSize: "12px",
                    color: "#155724",
                    wordBreak: "break-all"
                  }}>
                    {contractAddress}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right Side - Contract Information */}
        <div style={{ 
          width: "400px", 
          background: "white",
          borderLeft: "1px solid #dee2e6",
          padding: "24px",
          overflow: "auto"
        }}>
          <h3 style={{ 
            margin: "0 0 20px 0", 
            fontSize: "18px", 
            fontWeight: "600",
            color: "#212529"
          }}>
            Contract Information
          </h3>

          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#495057",
              marginBottom: 8
            }}>
              Contract Name
            </div>
            <div style={{ 
              padding: "8px 12px",
              background: "#f8f9fa",
              borderRadius: "6px",
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#212529"
            }}>
              {contract.name || contract.contractName}
            </div>
          </div>

          {contract.compilerVersion && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: "14px", 
                fontWeight: "600", 
                color: "#495057",
                marginBottom: 8
              }}>
                Compiler Version
              </div>
              <div style={{ 
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#212529"
              }}>
                {contract.compilerVersion}
              </div>
            </div>
          )}

          {/* Source Code Editor */}
          {contract.source && (
            <div style={{ marginTop: 24 }}>
              <div style={{ 
                fontSize: "14px", 
                fontWeight: "600", 
                color: "#495057",
                marginBottom: 8
              }}>
                Source Code
              </div>
              <div style={{
                border: "1px solid #dee2e6",
                borderRadius: "8px",
                overflow: "hidden",
                background: "#f8f9fa"
              }}>
                <div style={{
                  background: "#e9ecef",
                  padding: "8px 12px",
                  borderBottom: "1px solid #dee2e6",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#495057"
                }}>
                  Solidity
                </div>
                <pre style={{
                  margin: 0,
                  padding: "16px",
                  fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: "#212529",
                  background: "#ffffff",
                  overflow: "auto",
                  maxHeight: "300px"
                }}>
                  {contract.source}
                </pre>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#495057",
              marginBottom: 8
            }}>
              ABI Functions
            </div>
            <div style={{ 
              padding: "8px 12px",
              background: "#f8f9fa",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#212529"
            }}>
              {contract.abi?.length || 0} functions
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#495057",
              marginBottom: 8
            }}>
              Bytecode Length
            </div>
            <div style={{ 
              padding: "8px 12px",
              background: "#f8f9fa",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#212529"
            }}>
              {contract.bytecode?.length || 0} characters
            </div>
          </div>

          {contract.artifactPath && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: "14px", 
                fontWeight: "600", 
                color: "#495057",
                marginBottom: 8
              }}>
                Artifact Path
              </div>
              <div style={{ 
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#212529",
                wordBreak: "break-all"
              }}>
                {contract.artifactPath}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#495057",
              marginBottom: 8
            }}>
              Upload Date
            </div>
            <div style={{ 
              padding: "8px 12px",
              background: "#f8f9fa",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#212529"
            }}>
              {new Date(contract.uploadedAt).toLocaleString()}
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}
