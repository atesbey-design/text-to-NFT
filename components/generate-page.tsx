'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Image as ImageIcon, MessageSquare, Zap, LogOut } from "lucide-react"
import { ethers } from 'ethers'
import { Loader2 } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ContractABI from '../artifacts/contracts/NFTAuction.sol/TuncerByte.json'

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function GeneratePageComponent() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [nftMinted, setNftMinted] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isMintingNFT, setIsMintingNFT] = useState(false)
  const [showWalletDetails, setShowWalletDetails] = useState(false)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [mintedNFTs, setMintedNFTs] = useState<{ tokenId: string; transactionHash: string }[]>([])
  const [metadataUrl, setMetadataUrl] = useState<string | null>(null)

  useEffect(() => {
    checkWalletConnection()
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const network = await provider.getNetwork()
        if (network.chainId !== BigInt(11155111)) { // Sepolia testnet chain ID
          throw new Error('Please connect to the Sepolia testnet')
        }
        const accounts = await provider.listAccounts()
        if (accounts.length > 0) {
          const newSigner = await provider.getSigner()
          setWalletConnected(true)
          setWalletAddress(accounts[0].address)
          setSigner(newSigner)
          const contractInstance = await getContract(newSigner)
          setContract(contractInstance)
          await fetchMintedNFTs(contractInstance, accounts[0].address)
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error)
        alert(error instanceof Error ? error.message : 'An error occurred while checking wallet connection')
      }
    }
  }

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      try {
        setIsConnecting(true)
        await window.ethereum.request({ method: 'eth_requestAccounts' })
        const provider = new ethers.BrowserProvider(window.ethereum)
        const network = await provider.getNetwork()
        if (network.chainId !== BigInt(11155111)) { // Sepolia testnet chain ID
          throw new Error('Please connect to the Sepolia testnet')
        }
        const newSigner = await provider.getSigner()
        const address = await newSigner.getAddress()
        setWalletConnected(true)
        setWalletAddress(address)
        setShowWalletDetails(true)
        setSigner(newSigner)
        const contractInstance = await getContract(newSigner)
        setContract(contractInstance)
        await fetchMintedNFTs(contractInstance, address)
      } catch (error) {
        console.error('Failed to connect wallet:', error)
        alert(error instanceof Error ? error.message : 'An error occurred while connecting wallet')
      } finally {
        setIsConnecting(false)
      }
    } else {
      alert('Please install MetaMask!')
    }
  }

  const getContract = async (signer: ethers.Signer) => {
    const contractAddress = "0xACD6099C764e8bF4c39A769A23727844cDFeFfFE" // Replace with your contract address on Sepolia
    const contract = new ethers.Contract(contractAddress, ContractABI.abi, signer)
    return contract
  }

  const disconnectWallet = async () => {
    try {
      setIsDisconnecting(true)
      setWalletConnected(false)
      setWalletAddress('')
      setShowWalletDetails(false)
      setContract(null)
      setSigner(null)
      setMintedNFTs([])
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    } finally {
      setIsDisconnecting(false)
    }
  }

  const generateImage = async () => {
    try {
      setIsGeneratingImage(true)
      const response = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
        }
      );
      const blob = await response.blob();
      const base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      setGeneratedImage(base64Image as string);

      // Create metadata
      const metadataResponse = await fetch('/api/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: base64Image,
          name: `AI Generated NFT - ${Date.now()}`,
          description: prompt,
        }),
      });
      console.log('Metadata response:', metadataResponse);

      if (!metadataResponse.ok) {
        throw new Error('Failed to create metadata');
      }

      const metadata = await metadataResponse.json();
      console.log('Metadata created:', metadata);

      // You can use the metadata.metadataUrl for minting the NFT later
      // For example, you might want to store it in state:
      // setMetadataUrl(metadata.metadataUrl);
      setMetadataUrl(metadata.metadataUrl);

    } catch (error) {
      console.error('Failed to generate image or create metadata:', error);
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const sendChatMessage = async () => {
    if (chatInput.trim()) {
      setIsSendingMessage(true)
      setChatMessages([...chatMessages, { role: "user", content: chatInput }])
      
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: chatInput }]
              }]
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to get response from Gemini API');
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;

        setChatMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
      } catch (error) {
        console.error('Error in sendChatMessage:', error);
        setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      } finally {
        setIsSendingMessage(false)
      }

      setChatInput("")
    }
  }

  
  const mintNFT = async () => {
    if (!contract || !signer) {
      console.error('Contract or signer is not initialized');
      return;
    }

    setIsMintingNFT(true);
    try {
      const tx = await contract.mint(metadataUrl, "0x3C06daEBA080C2a440F3146Bf287fE210E3DE65B");
      const receipt = await tx.wait();
      setNftMinted(true);
      console.log('NFT minted successfully on Sepolia testnet');
      console.log(receipt);
      
      // Add the newly minted NFT to the list
      const newNFT = {
        tokenId: receipt.logs[0].args[2].toString(), // Use args instead of topics
        transactionHash: receipt.hash
      };
      setMintedNFTs(prev => [...prev, newNFT]);
    } catch (error) {
      console.error('Error minting NFT:', error);
      alert('Failed to mint NFT. Make sure you have enough Sepolia ETH.');
    } finally {
      setIsMintingNFT(false);
    }
  }

  const fetchMintedNFTs = async (contractInstance: ethers.Contract, address: string) => {
    try {
      const filter = contractInstance.filters.Transfer(null, address);
      const events = await contractInstance.queryFilter(filter);
      const nfts = events.map(event => {
        if ('args' in event) {
          return {
            tokenId: event.args[2].toString(),
            transactionHash: event.transactionHash
          };
        }
        // Handle the case where 'args' is not present (i.e., for Log type)
        return {
          tokenId: 'Unknown',
          transactionHash: event.transactionHash
        };
      });
      setMintedNFTs(nfts);
    } catch (error) {
      console.error('Error fetching minted NFTs:', error);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">AI NFT Oluşturucu (Sepolia Testnet)</h1>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sol Sütun - Chat Bölümü */}
        <div className="w-full md:w-1/2">
          <Card>
            <CardHeader>
              <CardTitle>AI ile Sohbet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-[400px] overflow-y-auto border rounded-lg p-4">
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-block p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <ReactMarkdown
                          components={{
                            code({node, className, children, ...props}) {
                              const match = /language-(\w+)/.exec(className || '')
                              return  match ? (
                                <SyntaxHighlighter
                                  children={String(children).replace(/\n$/, '')}
                                  style={dracula}
                                  language={match[1]}
                                  PreTag="div"
                                />
                              ) : (
                                <code {...props} className={className}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Görüntü için bir açıklama girin..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <Button onClick={sendChatMessage} disabled={isSendingMessage}>
                    {isSendingMessage ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    Gönder
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Sütun - Görüntü Oluşturma ve NFT */}
        <div className="w-full md:w-1/2">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Cüzdan Bağlantısı (Sepolia)</CardTitle>
            </CardHeader>
            <CardContent>
              {walletConnected ? (
                <div>
                  <p className="text-green-500">Cüzdan Bağlandı (Sepolia)</p>
                  {showWalletDetails && (
                    <p className="text-sm mt-2">Adres: {walletAddress}</p>
                  )}
                  <Button onClick={disconnectWallet} disabled={isDisconnecting} className="mt-2">
                    {isDisconnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="mr-2 h-4 w-4" />
                    )}
                    Bağlantıyı Kes
                  </Button>
                </div>
              ) : (
                <Button onClick={connectWallet} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wallet className="mr-2 h-4 w-4" />
                  )}
                  Sepolia Cüzdanını Bağla
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI ile Görüntü Oluştur</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  placeholder="Görüntü için bir açıklama girin..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <Button onClick={generateImage} disabled={isGeneratingImage}>
                  {isGeneratingImage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  Görüntü Oluştur
                </Button>
                {generatedImage && (
                  <div className="mt-4">
                    <img src={generatedImage} alt="Generated" className="rounded-lg w-full" />
                    <Button 
                      className="mt-2" 
                      onClick={mintNFT} 
                      disabled={!walletConnected || nftMinted || isMintingNFT}
                    >
                      {isMintingNFT ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      NFT Oluştur (Sepolia)
                    </Button>
                    {!walletConnected && (
                      <p className="text-yellow-500 mt-2">NFT oluşturmak için önce Sepolia cüzdanınızı bağlayın.</p>
                    )}
                    {nftMinted && <p className="text-green-500 mt-2">NFT başarıyla Sepolia'da oluşturuldu!</p>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Minted NFTs List */}
          {mintedNFTs.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Oluşturulan NFT'ler</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {mintedNFTs.map((nft, index) => (
                    <li key={index} className="text-sm">
                      <span className="font-bold">Token ID:</span> {nft.tokenId}
                      <br />
                      <span className="font-bold">İşlem Adresi:</span>{' '}
                      <a
                        href={`https://sepolia.etherscan.io/tx/${nft.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {nft.transactionHash.slice(0, 10)}...
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}