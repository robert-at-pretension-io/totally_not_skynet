export type Node = {
  id: string;
  label?: string;
  data?: any;
  source? : null; // need these purely for type checking
  target? : null; // need these purely for type checking... they will never ben assigned
};

export type Edge = {
  id: string;
  source: string; // Node id
  target: string; // Node id
  label?: string;
  data?: any; // purely for type checking.. never will be assigned
};

export type Graph = {
  nodes: Node[];
  edges: Edge[];
};

export type selectedGraphComponent = {
    type: "Node" | "Edge" | null;
    instance: Node | Edge;
    neighbors: Node[] | null;
    outgoing: Edge[] | null;
    incoming: Edge[] | null;
}

export type GraphState = {
  graph: Graph;
  selected: selectedGraphComponent | null;
  lastAction: "addNode" | "addEdge" | "removeNode" | "removeEdge" | "selectNode" | "deselectNode" | "none" | "selectEdge" | "deselectEdge" | "updateNode" | "updateEdge";
  actedOn: Node | Edge | null;
};

export type Action = {
  _id: String,
  prompt: String,
  name: String,
  system: String
}

export type Process = {
  _id: String,
  name: String,
  trigger: String,
  triggers_next_process: String,
  waits_for_branch_completion: boolean,
  description: String,
  creates_process_branch: boolean,
  branch_step: String
}

export type Message = {
  role: String,
  content: String
}

export type AiSystemState = {
  actions: Action[],
  processes: Process[],
  messages: Message[]
}

export type SystemState = {
  websocketReady: boolean,
  selectedAction: Action | null,
  selectedProcess: Process | null,
}

export type Goal = {
  text: string;
};

export type InitializeProject = {
  initial_message: string;
};

export type OpenaiKey = {
  key: string;
};

export type Prompt = {
  prompt_text: string;
}

export type MessageTypes =
  | { type: 'Goal'; data: Goal }
  | { type: 'InitializeProject'; data: InitializeProject }
  | { type: 'SetOpenAIKey'; data: OpenaiKey }
  | { type: 'Prompt'; data: Prompt}