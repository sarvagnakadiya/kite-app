"use client";

import { useCallback, useMemo, useState, useEffect, use } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { Abi, Hex } from "viem";
import { BaseError, encodeAbiParameters } from "viem";
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

interface ConstructorParam {
  name: string;
  type: string;
  internalType?: string;
}

export default function ContractDeployPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const [contractAddress, setContractAddress] = useState<`0x${string}` | "">(
    ""
  );

  // Verification state
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationStatus, setVerificationStatus] = useState<string>("");
  const [verificationGuid, setVerificationGuid] = useState<string>("");
  const [verificationMessage, setVerificationMessage] = useState<string>("");

  // Dynamic constructor arguments state
  const [constructorArgs, setConstructorArgs] = useState<
    Record<string, string>
  >({});
  const [useDynamicArgs, setUseDynamicArgs] = useState<boolean>(true);

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
          setError(data.message || "Contract not found");
        }
      } catch (err) {
        setError("Failed to load contract");
        console.error("Error loading contract:", err);
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

  // Extract constructor parameters from ABI
  const constructorParams = useMemo((): ConstructorParam[] => {
    if (!parsedAbi) return [];

    const constructor = parsedAbi.find(
      (item) => (item as { type?: string }).type === "constructor"
    ) as { inputs?: ConstructorParam[] } | undefined;

    return constructor?.inputs || [];
  }, [parsedAbi]);

  // Initialize constructor args when params change
  useEffect(() => {
    const initialArgs: Record<string, string> = {};
    constructorParams.forEach((param, index) => {
      initialArgs[`arg_${index}`] = "";
    });
    setConstructorArgs(initialArgs);
  }, [constructorParams]);

  // Build arguments array from dynamic inputs or JSON
  const finalArgs = useMemo(() => {
    if (!useDynamicArgs) {
      // Use JSON array format
      if (!argsText.trim()) return [] as unknown[];
      try {
        const maybe = JSON.parse(argsText);
        return Array.isArray(maybe) ? (maybe as unknown[]) : [];
      } catch {
        return [] as unknown[];
      }
    } else {
      // Use dynamic form inputs
      return constructorParams.map((param, index) => {
        const value = constructorArgs[`arg_${index}`] || "";

        // Convert value based on type
        if (value === "") return "";

        try {
          if (param.type === "bool" || param.type === "boolean") {
            return value.toLowerCase() === "true";
          } else if (
            param.type.includes("int") &&
            !param.type.includes("string")
          ) {
            return param.type.includes("uint") ? BigInt(value) : BigInt(value);
          } else if (param.type === "address") {
            return value as `0x${string}`;
          } else if (param.type === "bytes" || param.type.startsWith("bytes")) {
            return value as `0x${string}`;
          } else {
            return value;
          }
        } catch {
          return value;
        }
      });
    }
  }, [useDynamicArgs, argsText, constructorArgs, constructorParams]);

  // Encode constructor arguments for verification
  const encodedArgs = useMemo(() => {
    if (constructorParams.length === 0 || finalArgs.length === 0) {
      return "";
    }

    try {
      const types = constructorParams.map((param) => param.type);
      const encoded = encodeAbiParameters(
        types.map((type) => ({ type, name: "" })),
        finalArgs
      );
      return encoded.slice(2); // Remove 0x prefix for Etherscan
    } catch (error) {
      console.error("Error encoding constructor arguments:", error);
      return "";
    }
  }, [constructorParams, finalArgs]);

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

    // Validate constructor args count
    const requiredArgs = constructorParams.length;
    if (requiredArgs !== finalArgs.length) {
      setError(
        `Constructor expects ${requiredArgs} arg(s), but received ${finalArgs.length}.`
      );
      return;
    }

    const bytecode = normalizeBytecode(bytecodeText);
    if (!bytecode) {
      setError("Bytecode is required.");
      return;
    }

    setIsDeploying(true);
    try {
      const hash = await walletClient.deployContract({
        abi: parsedAbi,
        bytecode: bytecode,
        args: finalArgs as unknown[],
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
  }, [
    walletClient,
    publicClient,
    parsedAbi,
    bytecodeText,
    finalArgs,
    constructorParams.length,
    address,
  ]);

  const handleVerifyContract = useCallback(async () => {
    if (!contractAddress || !contract) {
      setVerificationMessage("No contract address or contract data available");
      return;
    }

    setIsVerifying(true);
    setVerificationStatus("");
    setVerificationMessage("");
    setVerificationGuid("");

    try {
      const response = await fetch("/api/verify-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractId: resolvedParams.id,
          contractAddress: contractAddress,
          constructorArgs: encodedArgs,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setVerificationGuid(data.guid || "");
        if (data.status) {
          setVerificationStatus(data.status.status || "");
          setVerificationMessage(
            data.status.message || "Verification submitted successfully"
          );
        } else {
          setVerificationStatus("submitted");
          setVerificationMessage("Verification submitted successfully");
        }
      } else {
        setVerificationStatus("failed");
        setVerificationMessage(data.message || "Verification failed");
      }
    } catch (error) {
      setVerificationStatus("failed");
      setVerificationMessage(
        error instanceof Error ? error.message : "Failed to verify contract"
      );
    } finally {
      setIsVerifying(false);
    }
  }, [contractAddress, contract, resolvedParams.id, encodedArgs]);

  const renderConstructorArgsForm = () => {
    if (constructorParams.length === 0) {
      return (
        <div
          style={{
            padding: "12px",
            background: "#e9ecef",
            borderRadius: "8px",
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", color: "#6c757d" }}>
            This contract has no constructor parameters.
          </p>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 16 }}>
        {constructorParams.map((param, index) => (
          <div key={index} style={{ marginBottom: 12 }}>
            <label
              style={{
                display: "block",
                fontWeight: "500",
                marginBottom: 4,
                color: "#495057",
                fontSize: "13px",
              }}
            >
              {param.name || `Parameter ${index + 1}`} ({param.type})
            </label>
            <input
              type="text"
              value={constructorArgs[`arg_${index}`] || ""}
              onChange={(e) =>
                setConstructorArgs((prev) => ({
                  ...prev,
                  [`arg_${index}`]: e.target.value,
                }))
              }
              placeholder={getPlaceholderForType(param.type)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #dee2e6",
                fontSize: "13px",
                fontFamily:
                  param.type === "address" || param.type.startsWith("bytes")
                    ? "'Fira Code', monospace"
                    : "inherit",
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  const getPlaceholderForType = (type: string): string => {
    if (type === "address") return "0x1234567890123456789012345678901234567890";
    if (type === "bool" || type === "boolean") return "true or false";
    if (type.includes("uint")) return "123";
    if (type.includes("int")) return "123";
    if (type === "string") return "Enter text";
    if (type === "bytes" || type.startsWith("bytes")) return "0x1234abcd";
    return `Enter ${type} value`;
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <div>Loading contract...</div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "50vh",
          padding: 32,
        }}
      >
        <h2>Contract Not Found</h2>
        <p style={{ color: "#666", marginBottom: 16 }}>{error}</p>
        <Link href="/" style={{ color: "#007bff", textDecoration: "none" }}>
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e9ecef",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              marginBottom: 4,
              fontSize: "24px",
              fontWeight: "600",
              color: "#212529",
            }}
          >
            Deploy {contract.name || contract.contractName}
          </h1>
          <div style={{ color: "#6c757d", fontSize: 14 }}>
            {contract.compilerVersion &&
              `Compiler: ${contract.compilerVersion} • `}
            {contract.artifactPath &&
              `Path: ${contract.artifactPath.split("/").pop()}`}
          </div>
        </div>
        <ConnectButton />
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 0,
          minHeight: "calc(100vh - 80px)",
        }}
      >
        {/* Left Side - Deployment */}
        <div
          style={{
            flex: 1,
            background: "white",
            padding: "24px",
            overflow: "auto",
          }}
        >
          <h2
            style={{
              margin: "0 0 24px 0",
              fontSize: "20px",
              fontWeight: "600",
              color: "#212529",
            }}
          >
            Deployment Configuration
          </h2>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontWeight: "600",
                marginBottom: 8,
                color: "#495057",
                fontSize: "14px",
              }}
            >
              ABI (JSON)
            </label>
            <textarea
              value={abiText}
              onChange={(e) => setAbiText(e.target.value)}
              placeholder='[ { "type": "constructor", ... }, { "name": "mint", ... } ]'
              rows={6}
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
                minHeight: "100px",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontWeight: "600",
                marginBottom: 8,
                color: "#495057",
                fontSize: "14px",
              }}
            >
              Bytecode (0x...)
            </label>
            <textarea
              value={bytecodeText}
              onChange={(e) => setBytecodeText(e.target.value)}
              placeholder="0x600..."
              rows={3}
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
                minHeight: "60px",
              }}
            />
          </div>

          {/* Constructor Arguments Section */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <label
                style={{
                  fontWeight: "600",
                  color: "#495057",
                  fontSize: "14px",
                }}
              >
                Constructor Arguments
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setUseDynamicArgs(true)}
                  style={{
                    padding: "4px 12px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    border: "1px solid #dee2e6",
                    background: useDynamicArgs ? "#007bff" : "white",
                    color: useDynamicArgs ? "white" : "#495057",
                    cursor: "pointer",
                  }}
                >
                  Form
                </button>
                <button
                  onClick={() => setUseDynamicArgs(false)}
                  style={{
                    padding: "4px 12px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    border: "1px solid #dee2e6",
                    background: !useDynamicArgs ? "#007bff" : "white",
                    color: !useDynamicArgs ? "white" : "#495057",
                    cursor: "pointer",
                  }}
                >
                  JSON
                </button>
              </div>
            </div>

            {useDynamicArgs ? (
              renderConstructorArgsForm()
            ) : (
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
                  background: "#f8f9fa",
                }}
              />
            )}

            {/* Display encoded arguments for verification */}
            {encodedArgs && (
              <div style={{ marginTop: 8 }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "500",
                    marginBottom: 4,
                    color: "#495057",
                    fontSize: "12px",
                  }}
                >
                  Encoded Arguments (for verification):
                </label>
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#e9ecef",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontFamily: "'Fira Code', monospace",
                    wordBreak: "break-all",
                    color: "#495057",
                  }}
                >
                  {encodedArgs}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                color: "#dc3545",
                marginBottom: 16,
                padding: "12px",
                background: "#f8d7da",
                border: "1px solid #f5c6cb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "20px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
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
                minWidth: "120px",
              }}
            >
              {isDeploying ? "Deploying..." : "Deploy Contract"}
            </button>
            <div style={{ flex: 1 }}>
              {address ? (
                <div style={{ color: "#495057", fontSize: "14px" }}>
                  <strong>Wallet:</strong> {address.slice(0, 6)}...
                  {address.slice(-4)}
                </div>
              ) : (
                <div style={{ color: "#6c757d", fontSize: "14px" }}>
                  Connect a wallet to deploy
                </div>
              )}
            </div>
          </div>

          {txHash && (
            <div
              style={{
                marginTop: 24,
                padding: "16px",
                background: "#d4edda",
                border: "1px solid #c3e6cb",
                borderRadius: "8px",
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: "#155724" }}>Transaction Hash:</strong>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "12px",
                    color: "#155724",
                    wordBreak: "break-all",
                  }}
                >
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {txHash}
                  </a>
                </div>
              </div>
              {contractAddress && (
                <div>
                  <strong style={{ color: "#155724" }}>
                    Contract Address:
                  </strong>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "12px",
                      color: "#155724",
                      wordBreak: "break-all",
                    }}
                  >
                    {contractAddress}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification Section */}
          {contractAddress && (
            <div
              style={{
                marginTop: 24,
                padding: "20px",
                background: "#f8f9fa",
                borderRadius: "8px",
                border: "1px solid #dee2e6",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#212529",
                }}
              >
                Contract Verification
              </h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <button
                  onClick={() => void handleVerifyContract()}
                  disabled={isVerifying || !contractAddress}
                  style={{
                    background:
                      !isVerifying && contractAddress ? "#007bff" : "#6c757d",
                    color: "#fff",
                    padding: "12px 24px",
                    border: "none",
                    borderRadius: "8px",
                    cursor:
                      !isVerifying && contractAddress
                        ? "pointer"
                        : "not-allowed",
                    fontSize: "16px",
                    fontWeight: "600",
                    transition: "all 0.2s",
                    minWidth: "140px",
                  }}
                >
                  {isVerifying ? "Verifying..." : "Verify Contract"}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#495057", fontSize: "14px" }}>
                    <strong>Contract Address:</strong>{" "}
                    {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                  </div>
                </div>
              </div>

              {verificationMessage && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    marginBottom: 16,
                    ...(verificationStatus === "failed"
                      ? {
                          color: "#dc3545",
                          background: "#f8d7da",
                          border: "1px solid #f5c6cb",
                        }
                      : verificationStatus === "verified" ||
                        verificationStatus === "already_verified"
                      ? {
                          color: "#155724",
                          background: "#d4edda",
                          border: "1px solid #c3e6cb",
                        }
                      : {
                          color: "#856404",
                          background: "#fff3cd",
                          border: "1px solid #ffeaa7",
                        }),
                  }}
                >
                  <strong>
                    {verificationStatus === "failed"
                      ? "Verification Failed:"
                      : verificationStatus === "verified"
                      ? "Verification Successful:"
                      : verificationStatus === "already_verified"
                      ? "Already Verified:"
                      : "Verification Status:"}
                  </strong>
                  <div style={{ marginTop: 4 }}>{verificationMessage}</div>
                  {verificationGuid && (
                    <div style={{ marginTop: 8 }}>
                      <strong>GUID:</strong>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "12px",
                          wordBreak: "break-all",
                          marginTop: 4,
                        }}
                      >
                        {verificationGuid}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side - Contract Information */}
        <div
          style={{
            width: "400px",
            background: "white",
            borderLeft: "1px solid #dee2e6",
            padding: "24px",
            overflow: "auto",
          }}
        >
          <h3
            style={{
              margin: "0 0 20px 0",
              fontSize: "18px",
              fontWeight: "600",
              color: "#212529",
            }}
          >
            Contract Information
          </h3>

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
                marginBottom: 8,
              }}
            >
              Contract Name
            </div>
            <div
              style={{
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#212529",
              }}
            >
              {contract.name || contract.contractName}
            </div>
          </div>

          {contract.compilerVersion && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#495057",
                  marginBottom: 8,
                }}
              >
                Compiler Version
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#f8f9fa",
                  borderRadius: "6px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#212529",
                }}
              >
                {contract.compilerVersion}
              </div>
            </div>
          )}

          {/* Constructor Parameters Info */}
          {constructorParams.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#495057",
                  marginBottom: 8,
                }}
              >
                Constructor Parameters
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#f8f9fa",
                  borderRadius: "6px",
                  fontSize: "13px",
                  color: "#212529",
                }}
              >
                {constructorParams.map((param, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace" }}>
                      {param.name || `param${index}`}: {param.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
                marginBottom: 8,
              }}
            >
              ABI Functions
            </div>
            <div
              style={{
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#212529",
              }}
            >
              {contract.abi?.length || 0} functions
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
                marginBottom: 8,
              }}
            >
              Bytecode Length
            </div>
            <div
              style={{
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#212529",
              }}
            >
              {contract.bytecode?.length || 0} characters
            </div>
          </div>

          {contract.artifactPath && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#495057",
                  marginBottom: 8,
                }}
              >
                Artifact Path
              </div>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#f8f9fa",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#212529",
                  wordBreak: "break-all",
                }}
              >
                {contract.artifactPath}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#495057",
                marginBottom: 8,
              }}
            >
              Upload Date
            </div>
            <div
              style={{
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#212529",
              }}
            >
              {new Date(contract.uploadedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
