import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">WebAgent RAG</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Crawl any website or upload a document — then chat with it. The AI
            critiques its own answers and can contact the company on your
            behalf.
          </p>
        </div>

        <ChatWindow isReady={true} />
      </div>
    </main>
  );
}
