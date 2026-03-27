"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Keyword {
  id: string;
  keyword: string;
  active: boolean;
  hitCount: number;
  createdAt: string;
}

export default function AdminKeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  function fetchKeywords() {
    fetch("/api/admin/keywords")
      .then((r) => r.json())
      .then((data) => {
        setKeywords(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function handleAdd() {
    if (!newKeyword.trim()) return;
    await fetch("/api/admin/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: newKeyword.trim() }),
    });
    setNewKeyword("");
    fetchKeywords();
  }

  async function handleDelete(id: string) {
    await fetch("/api/admin/keywords", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchKeywords();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Keyword Alerts</h1>

      <div className="flex gap-2 mb-6 max-w-md">
        <Input
          placeholder="Add keyword..."
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={!newKeyword.trim()}>
          Add
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Keyword</th>
              <th className="text-left p-3 font-medium">Hits</th>
              <th className="text-left p-3 font-medium">Added</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="p-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : keywords.map((kw) => (
                  <tr key={kw.id}>
                    <td className="p-3 font-mono">{kw.keyword}</td>
                    <td className="p-3 text-muted-foreground">{kw.hitCount}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(kw.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(kw.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
