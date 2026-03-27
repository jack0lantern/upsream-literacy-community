"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ProblemStatement {
  id: string;
  label: string;
  category: string;
  sortOrder: number;
  active: boolean;
  userCount: number;
}

export default function AdminProblemsPage() {
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");

  function fetchProblems() {
    fetch("/api/admin/problems")
      .then((r) => r.json())
      .then((data) => {
        setProblems(data);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchProblems();
  }, []);

  async function handleCreate() {
    await fetch("/api/admin/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newLabel,
        category: newCategory,
        sortOrder: parseInt(newSortOrder),
      }),
    });
    setNewLabel("");
    setNewCategory("");
    setNewSortOrder("");
    fetchProblems();
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/admin/problems/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !currentActive }),
    });
    fetchProblems();
  }

  const categories = [...new Set(problems.map((p) => p.category))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Problem Statements</h1>
        <Dialog>
          <DialogTrigger
            render={(props) => <Button {...props}>Add New</Button>}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Problem Statement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g., Implementing Science of Reading practices"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g., Curriculum & Instruction"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="e.g., 21"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!newLabel || !newCategory || !newSortOrder}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            {cat}
          </h2>
          <div className="border rounded-lg divide-y">
            {problems
              .filter((p) => p.category === cat)
              .map((problem) => (
                <div
                  key={problem.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">
                      #{problem.sortOrder}
                    </span>
                    <span
                      className={
                        problem.active ? "" : "text-muted-foreground line-through"
                      }
                    >
                      {problem.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {problem.userCount} users
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleToggleActive(problem.id, problem.active)
                      }
                    >
                      {problem.active ? "Retire" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
