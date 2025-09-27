"use client";

import { useCallback, useMemo, useState, useEffect, use } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useConfig } from "wagmi";
import type { Abi, Hex } from "viem";
import { BaseError, encodeFunctionData } from "viem";
import { sendCalls, waitForCallsStatus } from "@wagmi/core";
import Link from "next/link";

interface FunctionParam {
  name: string;
  type: string;
  value: string;
}

interface FunctionData {
  name: string;
  signature: string;
  contract: string;
  contract_address: string;
  params: FunctionParam[];
}

interface TransactionData {
  _id: string;
  functions: FunctionData[];
  uploadedAt: string;
  createdAt: string;
}

export default function TransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const wagmiConfig = useConfig();

  const [transactionData, setTransactionData] =
    useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<`0x${string}` | "">("");
  const [executionStatus, setExecutionStatus] = useState<string>("");
  const [executionMessage, setExecutionMessage] = useState<string>("");

  // Dynamic parameter values
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // Unwrap params
  const resolvedParams = use(params);

  // Load transaction data
  useEffect(() => {
    const loadTransactionData = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/transactions/${resolvedParams.id}`);
        const data = await response.json();

        if (data.success) {
          setTransactionData(data.transaction);

          // Initialize parameter values with default values from the data
          const initialValues: Record<string, string> = {};
          data.transaction.functions.forEach(
            (func: FunctionData, funcIndex: number) => {
              func.params.forEach(
                (param: FunctionParam, paramIndex: number) => {
                  const key = `${funcIndex}_${paramIndex}`;
                  initialValues[key] = param.value;
                }
              );
            }
          );
          setParamValues(initialValues);
        } else {
          setError(data.message || "Transaction data not found");
        }
      } catch (err) {
        setError("Failed to load transaction data");
        console.error("Error loading transaction data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTransactionData();
  }, [resolvedParams.id]);

  // Get current parameter values
  const getCurrentParamValue = (
    funcIndex: number,
    paramIndex: number
  ): string => {
    const key = `${funcIndex}_${paramIndex}`;
    return paramValues[key] || "";
  };

  // Update parameter value
  const updateParamValue = (
    funcIndex: number,
    paramIndex: number,
    value: string
  ) => {
    const key = `${funcIndex}_${paramIndex}`;
    setParamValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Convert parameter value based on type
  const convertParamValue = (value: string, type: string): any => {
    if (value === "") return "";

    try {
      if (type === "bool" || type === "boolean") {
        return value.toLowerCase() === "true";
      } else if (type.includes("uint") || type.includes("int")) {
        return value;
      } else if (type === "address") {
        return value as `0x${string}`;
      } else if (type === "bytes" || type.startsWith("bytes")) {
        return value as `0x${string}`;
      } else {
        return value;
      }
    } catch {
      return value;
    }
  };

  // Generate ABI for a function
  const generateFunctionAbi = (func: FunctionData): Abi => {
    const inputs = func.params.map((param) => ({
      name: param.name,
      type: param.type,
    }));

    return [
      {
        type: "function",
        name: func.name,
        inputs,
        outputs: [],
        stateMutability: "nonpayable" as const,
      },
    ];
  };

  // Execute multi-call transaction
  const handleExecuteTransaction = useCallback(async () => {
    if (!transactionData || !walletClient || !publicClient) {
      setError("Transaction data or wallet not available");
      return;
    }

    setIsExecuting(true);
    setError("");
    setTxHash("");
    setExecutionStatus("");
    setExecutionMessage("");

    try {
      const calls = [];

      for (
        let funcIndex = 0;
        funcIndex < transactionData.functions.length;
        funcIndex++
      ) {
        const func = transactionData.functions[funcIndex];
        const abi = generateFunctionAbi(func);

        // Get current parameter values
        const args = func.params.map((param, paramIndex) => {
          const value = getCurrentParamValue(funcIndex, paramIndex);
          return convertParamValue(value, param.type);
        });

        // Encode function data
        const calldata = encodeFunctionData({
          abi,
          functionName: func.name,
          args,
        });

        calls.push({
          to: func.contract_address as `0x${string}`,
          data: calldata,
          value: BigInt(0),
        });
      }

      console.log("Executing calls:", calls);

      // Send the multi-call transaction
      const { id } = await sendCalls(wagmiConfig, {
        calls,
      });

      setTxHash(id as `0x${string}`);
      setExecutionStatus("pending");
      setExecutionMessage("Transaction submitted, waiting for confirmation...");

      // Wait for transaction status
      const { receipts } = await waitForCallsStatus(wagmiConfig, { id });

      if (receipts && receipts.length > 0) {
        setExecutionStatus("success");
        setExecutionMessage("Transaction executed successfully!");
      } else {
        setExecutionStatus("failed");
        setExecutionMessage("Transaction failed or was reverted");
      }
    } catch (e: unknown) {
      const message =
        e instanceof BaseError
          ? e.shortMessage || e.message
          : e instanceof Error
          ? e.message
          : String(e);
      setError(message || "Transaction execution failed");
      setExecutionStatus("failed");
      setExecutionMessage(message || "Transaction execution failed");
    } finally {
      setIsExecuting(false);
    }
  }, [transactionData, walletClient, publicClient, wagmiConfig, paramValues]);

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
        <div>Loading transaction data...</div>
      </div>
    );
  }

  if (error || !transactionData) {
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
        <h2>Transaction Data Not Found</h2>
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
            Multi-Call Transaction
          </h1>
          <div style={{ color: "#6c757d", fontSize: 14 }}>
            Execute {transactionData.functions.length} function calls in a
            single transaction
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
        {/* Left Side - Transaction Details */}
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
            Function Calls
          </h2>

          {transactionData.functions.map((func, funcIndex) => (
            <div
              key={funcIndex}
              style={{
                marginBottom: 24,
                padding: "20px",
                background: "#f8f9fa",
                borderRadius: "8px",
                border: "1px solid #dee2e6",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#212529",
                    }}
                  >
                    {func.name}
                  </h3>
                  <div
                    style={{
                      fontFamily: "'Fira Code', monospace",
                      fontSize: "13px",
                      color: "#6c757d",
                      marginBottom: 8,
                    }}
                  >
                    {func.signature}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6c757d",
                    }}
                  >
                    Contract: {func.contract} ({func.contract_address})
                  </div>
                </div>
              </div>

              {/* Function Parameters */}
              {func.params.length > 0 && (
                <div>
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#495057",
                    }}
                  >
                    Parameters:
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {func.params.map((param, paramIndex) => (
                      <div key={paramIndex}>
                        <label
                          style={{
                            display: "block",
                            fontWeight: "500",
                            marginBottom: 4,
                            color: "#495057",
                            fontSize: "13px",
                          }}
                        >
                          {param.name} ({param.type})
                        </label>
                        <input
                          type="text"
                          value={getCurrentParamValue(funcIndex, paramIndex)}
                          onChange={(e) =>
                            updateParamValue(
                              funcIndex,
                              paramIndex,
                              e.target.value
                            )
                          }
                          placeholder={getPlaceholderForType(param.type)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #dee2e6",
                            fontSize: "13px",
                            fontFamily:
                              param.type === "address" ||
                              param.type.startsWith("bytes")
                                ? "'Fira Code', monospace"
                                : "inherit",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

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

          {/* Execution Status */}
          {executionMessage && (
            <div
              style={{
                padding: "12px",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: 16,
                ...(executionStatus === "failed"
                  ? {
                      color: "#dc3545",
                      background: "#f8d7da",
                      border: "1px solid #f5c6cb",
                    }
                  : executionStatus === "success"
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
                {executionStatus === "failed"
                  ? "Execution Failed:"
                  : executionStatus === "success"
                  ? "Execution Successful:"
                  : "Execution Status:"}
              </strong>
              <div style={{ marginTop: 4 }}>{executionMessage}</div>
              {txHash && (
                <div style={{ marginTop: 8 }}>
                  <strong>Transaction ID:</strong>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "12px",
                      wordBreak: "break-all",
                      marginTop: 4,
                    }}
                  >
                    {txHash}
                  </div>
                </div>
              )}
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
              onClick={() => void handleExecuteTransaction()}
              disabled={!isConnected || isExecuting}
              style={{
                background: isConnected && !isExecuting ? "#007bff" : "#6c757d",
                color: "#fff",
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                cursor: isConnected && !isExecuting ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "600",
                transition: "all 0.2s",
                minWidth: "160px",
              }}
            >
              {isExecuting ? "Executing..." : "Execute Transaction"}
            </button>
            <div style={{ flex: 1 }}>
              {address ? (
                <div style={{ color: "#495057", fontSize: "14px" }}>
                  <strong>Wallet:</strong> {address.slice(0, 6)}...
                  {address.slice(-4)}
                </div>
              ) : (
                <div style={{ color: "#6c757d", fontSize: "14px" }}>
                  Connect a wallet to execute transaction
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Transaction Information */}
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
            Transaction Information
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
              Transaction ID
            </div>
            <div
              style={{
                padding: "8px 12px",
                background: "#f8f9fa",
                borderRadius: "6px",
                fontFamily: "monospace",
                fontSize: "13px",
                color: "#212529",
                wordBreak: "break-all",
              }}
            >
              {transactionData._id}
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
              Number of Functions
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
              {transactionData.functions.length} functions
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
              Functions List
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
              {transactionData.functions.map((func, index) => (
                <div key={index} style={{ marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace" }}>
                    {index + 1}. {func.name}
                  </span>
                </div>
              ))}
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
              Created Date
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
              {new Date(transactionData.createdAt).toLocaleString()}
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
              {new Date(transactionData.uploadedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
