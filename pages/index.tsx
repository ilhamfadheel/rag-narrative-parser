import Head from "next/head";
import { ChangeEvent, useId, useState, useRef } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkedSlider } from "@/components/ui/linkedslider";
import { Textarea } from "@/components/ui/textarea";
import {Download, Upload } from "lucide-react";

interface Character {
    id: number;
    name: string;
    description: string;
    personality: string;
}

const DEFAULT_CHUNK_SIZE = 1024;
const DEFAULT_CHUNK_OVERLAP = 20;
const DEFAULT_TOP_K = 2;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_TOP_P = 1;

export default function Home() {
    const answerId = useId();
    const queryId = useId();
    const sourceId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [text, setText] = useState("");
    const [query, setQuery] = useState("");
    const [needsNewIndex, setNeedsNewIndex] = useState(true);
    const [buildingIndex, setBuildingIndex] = useState(false);
    const [runningQuery, setRunningQuery] = useState(false);
    const [nodesWithEmbedding, setNodesWithEmbedding] = useState([]);
    const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE.toString());
    const [chunkOverlap, setChunkOverlap] = useState(
        DEFAULT_CHUNK_OVERLAP.toString(),
    );
    const [topK, setTopK] = useState(DEFAULT_TOP_K.toString());
    const [temperature, setTemperature] = useState(
        DEFAULT_TEMPERATURE.toString(),
    );
    const [topP, setTopP] = useState(DEFAULT_TOP_P.toString());
    const [answer, setAnswer] = useState("");
    const [characters, setCharacters] = useState<Character[]>([]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                // Clean up the text by removing excessive whitespace
                const cleanedContent = content
                    .replace(/^\s+|\s+$/g, '') // Remove leading and trailing whitespace
                    .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace triple line breaks with double line breaks
                    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
                    .trim(); // Trim any remaining whitespace from start and end
                setText(cleanedContent);
                setNeedsNewIndex(true);
            };
            reader.readAsText(file);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExtractCharacters = async () => {
        setAnswer("Extracting characters...");
        setRunningQuery(true);
        const result = await fetch("/api/retrieveandquery", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: "Extract all characters from the text. For each character, provide their name, a brief description, and key personality traits.",
                nodesWithEmbedding,
                topK: parseInt(topK),
                temperature: parseFloat(temperature),
                topP: parseFloat(topP),
                structuredOutput: true,
            }),
        });

        const { error, payload } = await result.json();

        if (error) {
            setAnswer(error);
        }

        if (payload) {
            setCharacters(payload.characters);
            setAnswer("Characters extracted successfully!");
        }

        setRunningQuery(false);
    };

    const handleExportCharacters = () => {
        const jsonString = JSON.stringify(characters, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = href;
        link.download = "extracted_characters.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    };

    return (
        <>
            <Head>
                <title>LlamaIndex.TS Playground</title>
            </Head>
            <main className="mx-2 flex h-full flex-col lg:mx-56">
                <div className="space-y-2">
                    <Label>Settings:</Label>
                    <div>
                        <LinkedSlider
                            label="Chunk Size:"
                            description={
                                "The maximum size of the chunks we are searching over, in tokens. " +
                                "The bigger the chunk, the more likely that the information you are looking " +
                                "for is in the chunk, but also the more likely that the chunk will contain " +
                                "irrelevant information."
                            }
                            min={1}
                            max={3000}
                            step={1}
                            value={chunkSize}
                            onChange={(value: string) => {
                                setChunkSize(value);
                                setNeedsNewIndex(true);
                            }}
                        />
                    </div>
                    <div>
                        <LinkedSlider
                            label="Chunk Overlap:"
                            description={
                                "The maximum amount of overlap between chunks, in tokens. " +
                                "Overlap helps ensure that sufficient contextual information is retained."
                            }
                            min={1}
                            max={600}
                            step={1}
                            value={chunkOverlap}
                            onChange={(value: string) => {
                                setChunkOverlap(value);
                                setNeedsNewIndex(true);
                            }}
                        />
                    </div>
                </div>
                <div className="my-2 flex h-3/4 flex-auto flex-col space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor={sourceId}>Source text:</Label>
                        <input
                            type="file"
                            accept=".txt"
                            onChange={handleFileChange}
                            className="hidden"
                            ref={fileInputRef}
                        />
                        <Button onClick={handleImportClick} variant="outline" size="sm">
                            <Upload className="mr-2 h-4 w-4" />
                            Import .txt file
                        </Button>
                    </div>
                    <Textarea
                        id={sourceId}
                        value={text}
                        className="flex-1"
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                            setText(e.target.value);
                            setNeedsNewIndex(true);
                        }}
                    />
                </div>
                <Button
                    disabled={!needsNewIndex || buildingIndex || runningQuery}
                    onClick={async () => {
                        setAnswer("Building index...");
                        setBuildingIndex(true);
                        setNeedsNewIndex(false);
                        // Post the text and settings to the server
                        const result = await fetch("/api/splitandembed", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                document: text,
                                chunkSize: parseInt(chunkSize),
                                chunkOverlap: parseInt(chunkOverlap),
                            }),
                        });
                        const { error, payload } = await result.json();

                        if (error) {
                            setAnswer(error);
                        }

                        if (payload) {
                            setNodesWithEmbedding(payload.nodesWithEmbedding);
                            setAnswer("Index built!");
                        }

                        setBuildingIndex(false);
                    }}
                >
                    {buildingIndex ? "Building Vector index..." : "Build index"}
                </Button>

                {!buildingIndex && !needsNewIndex && !runningQuery && (
                    <>
                        <LinkedSlider
                            className="my-2"
                            label="Top K:"
                            description={
                                "The maximum number of chunks to return from the search. " +
                                "It's called Top K because we are retrieving the K nearest neighbors of the query."
                            }
                            min={1}
                            max={15}
                            step={1}
                            value={topK}
                            onChange={(value: string) => {
                                setTopK(value);
                            }}
                        />

                        <LinkedSlider
                            className="my-2"
                            label="Temperature:"
                            description={
                                "Temperature controls the variability of model response. Adjust it " +
                                "downwards to get more consistent responses, and upwards to get more diversity."
                            }
                            min={0}
                            max={1}
                            step={0.01}
                            value={temperature}
                            onChange={(value: string) => {
                                setTemperature(value);
                            }}
                        />

                        <LinkedSlider
                            className="my-2"
                            label="Top P:"
                            description={
                                "Top P is another way to control the variability of the model " +
                                "response. It filters out low probability options for the model. It's " +
                                "recommended by OpenAI to set temperature to 1 if you're adjusting " +
                                "the top P."
                            }
                            min={0}
                            max={1}
                            step={0.01}
                            value={topP}
                            onChange={(value: string) => {
                                setTopP(value);
                            }}
                        />

                        <Button
                            className="my-2"
                            onClick={handleExtractCharacters}
                            disabled={runningQuery}
                        >
                            Extract Characters
                        </Button>

                        {characters.length > 0 && (
                            <div className="my-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h2 className="text-xl font-bold">Extracted Characters</h2>
                                    <Button onClick={handleExportCharacters} variant="outline" size="sm">
                                        <Download className="mr-2 h-4 w-4" />
                                        Export Characters
                                    </Button>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Personality</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {characters.map((character) => (
                                            <TableRow key={character.id}>
                                                <TableCell>{character.name}</TableCell>
                                                <TableCell>{character.description}</TableCell>
                                                <TableCell>{character.personality}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        <div className="my-2 space-y-2">
                            <Label htmlFor={queryId}>Query:</Label>
                            <div className="flex w-full space-x-2">
                                <Input
                                    id={queryId}
                                    value={query}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                        setQuery(e.target.value);
                                    }}
                                />
                                <Button
                                    type="submit"
                                    disabled={needsNewIndex || buildingIndex || runningQuery}
                                    onClick={async () => {
                                        setAnswer("Running query...");
                                        setRunningQuery(true);
                                        // Post the query and nodesWithEmbedding to the server
                                        const result = await fetch("/api/retrieveandquery", {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                            },
                                            body: JSON.stringify({
                                                query,
                                                nodesWithEmbedding,
                                                topK: parseInt(topK),
                                                temperature: parseFloat(temperature),
                                                topP: parseFloat(topP),
                                            }),
                                        });

                                        const { error, payload } = await result.json();

                                        if (error) {
                                            setAnswer(error);
                                        }

                                        if (payload) {
                                            setAnswer(payload.response);
                                        }

                                        setRunningQuery(false);
                                    }}
                                >
                                    Submit
                                </Button>
                            </div>
                        </div>
                        <div className="my-2 flex h-1/4 flex-auto flex-col space-y-2">
                            <Label htmlFor={answerId}>Answer:</Label>
                            <Textarea
                                className="flex-1 min-h-[200px]"
                                readOnly
                                value={answer}
                                id={answerId}
                            />
                        </div>
                    </>
                )}
            </main>
        </>
    );
}