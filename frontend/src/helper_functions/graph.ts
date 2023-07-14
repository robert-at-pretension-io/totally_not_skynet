import type {
  SystemState,
  Prompt,
  Node,
  MongoId,
  CrudBundle
} from "../system_types";
import { Process } from "../system_types";
import systemStateStore from "stores/systemStateStore";
import { Graph } from "graphlib";
import { Edge } from "@dagrejs/graphlib";
import { alg } from "graphlib";
import { some } from "fp-ts/lib/Option";
import { Option, isSome } from "fp-ts/Option";
import { unsafeCoerce } from 'fp-ts/lib/function';

// Define the getter and setter

export async function getSystemState(): Promise<SystemState> {
  return new Promise((resolve, _rej) => {
    systemStateStore.subscribe((systemStateStore) => {
      resolve(systemStateStore);
    });
  });
}

export async function getInputVariablesByNodeId(nodeId: string): Promise<string[] | null> {
  // Get the action by ID
  const node = await getNodeById(nodeId);

  if (node && node.type_name === "Prompt") {
    const node_content = node.node_content as Prompt;
    return node_content.prompt.input_variables;
  }
  return null;
}

export async function validateGraph(): Promise<string[] | boolean> {
  const systemState = await getSystemState();
  const graph = systemState.graphState.graph;


  if (isSome(systemState.selectedNode)) {
    let selected_node: Node = unsafeCoerce(systemState.selectedNode);
    if (selected_node.type_name == "Process") {
      let process: Process = selected_node.node_content as Process;
      let initial_variables = process.Process.initial_variables;

      let test_orders: string[][] = getAllTopologicalOrders(graph);

      for (let i = 0; i++; i < test_orders.length) {
        let current_order = test_orders[i];

        // to test the order we need to keep track of which variables have already been defined by collecting the output variables in an array as we go, then we only need to determine if the input variables are in the array

        let agregate_variables = initial_variables;

        for (let j = 0; j++; j < current_order.length) {
          let current_node = current_order[j];
          let node = await getNodeById(current_node);
          if (node) {
            let input_variables = node.input_variables;
            let output_variables = node.output_variables;

            // check if all of the input variables are in the agregate_variables array
            let input_variables_in_agregate = input_variables.every((variable) => {
              return agregate_variables.includes(variable);
            });

            // if the input variables are in the agregate_variables array, then add the output variables to the agregate_variables array
            if (input_variables_in_agregate) {
              agregate_variables.push(...output_variables);
              // if we are on the last node, then we have a valid order
              if (j == current_order.length - 1) {
                return current_order;
              }
            }
            else {
              return false;
            }
          }
          else {
            return false;
          }

        }

      }
      return false;

    }
    else {
      return false;
    }
  }
  return false;
}

export function getAllTopologicalOrders(graph: Graph): string[][] {
  // check that there is a single component (that the graph is connected) AND
  // that there are no cycles in the graph

  if (!alg.isAcyclic(graph) || alg.components(graph).length !== 1) {
    return [];
  }

  // get the local graph
  let local_graph = graphToLocalGraph(graph);

  return allTopologicalSorts(local_graph);

}


interface LocalGraph {
  [key: string]: string[];
}

export function graphToLocalGraph(graph: Graph): LocalGraph {
  let local_graph: LocalGraph = {};

  let my_nodes = graph.nodes();

  for (let i = 0; i < my_nodes.length; i++) {
    let node = my_nodes[i];
    let neighbors = graph.successors(node);
    if (neighbors) {
      local_graph[node] = neighbors;
    }
  }

  return local_graph;
}



function allTopologicalSorts(graph: LocalGraph): string[][] {
  let allOrderings: string[][] = [];
  let indegreeMap = calculateIndegreeForAllVertex(graph);
  let startNodes = Array.from(Object.keys(indegreeMap)).filter((node) => indegreeMap[node] === 0);
  let visited: { [node: string]: boolean } = {};

  for (let node in graph) {
    visited[node] = false;
  }

  function helper(node: string, indegreeMap: { [node: string]: number }, visited: { [node: string]: boolean }, stack: string[]): void {
    visited[node] = true;
    stack.push(node);

    if (stack.length === Object.keys(graph).length) {
      allOrderings.push([...stack]);
    } else {
      for (let neighbor of graph[node]) {
        indegreeMap[neighbor]--;
        if (indegreeMap[neighbor] === 0 && !visited[neighbor]) {
          helper(neighbor, indegreeMap, visited, stack);
        }
        indegreeMap[neighbor]++;
      }
    }

    visited[node] = false;
    stack.pop();
  }

  for (let node of startNodes) {
    helper(node, { ...indegreeMap }, { ...visited }, []);
  }

  return allOrderings;
}

function calculateIndegreeForAllVertex(graph: LocalGraph): { [node: string]: number } {
  let indegreeMap: { [node: string]: number } = {};

  for (let node in graph) {
    indegreeMap[node] = 0;
  }

  for (let node in graph) {
    for (let neighbor of graph[node]) {
      indegreeMap[neighbor]++;
    }
  }

  return indegreeMap;
}


export async function getOutputVariablesByNodeId(nodeId: string): Promise<string[] | null> {
  // Get the node by Id
  const node = await getNodeById(nodeId);
  if (node && node.type_name === "Prompt") {
    const node_content = node.node_content as Prompt;
    return node_content.prompt.output_variables;
  }
  return null;
}

export function getGlobalVariableNames() {
  let globalVariableNames: string[] = [];
  systemStateStore.subscribe(store => {
    globalVariableNames = Array.from(store.graphState.global_variables.keys());
  })();
  return globalVariableNames;
}

export async function getAncestorNodes(node: string, graph: Graph): Promise<Node[]> {
  const ancestors: Node[] = [];
  const visitedNodes = new Set<string>();
  const stack = [node];

  while (stack.length) {
    const currentNode = stack.pop()!;
    visitedNodes.add(currentNode);

    const parentNodes = graph.predecessors(currentNode);
    if (parentNodes) {
      parentNodes.forEach(async parentNode => {
        if (!visitedNodes.has(parentNode)) {
          const parent_node = await getNodeById(parentNode);
          if (parent_node) {
            ancestors.push(parent_node);
            stack.push(parentNode);
          }

        }
      });
    }
  }

  return ancestors;
}

export async function getNodeById(id: string): Promise<Node | undefined> {
  const systemState = await getSystemState();
  const prompt = systemState.nodes.find((node: Node) => {
    if (node._id) {
      return getId(node) == id;
    }
  });
  return prompt;
}

export async function getNodeInputVariables(node_id: string): Promise<string[] | null> {
  const node = await getNodeById(node_id);
  if (node) {
    return node.input_variables
  }
  else return null;
}

export function topologicalSort(graph: Graph) {
  const sorted = alg.topsort(graph);

  // The stack now contains a topological ordering of the nodes
  return sorted;
}

// get the name of the action by using the id
export async function getNodeName(id: string): Promise<string | undefined> {
  const system_state = await getSystemState();

  const node = system_state.nodes.find((node: Node) => {
    // get the node with the id:
    if (node._id) {
      return getId(node) == id;
    }
  });
  if (node) {
    return node.name;
  }
}

export async function printEdge(edge: Edge) {
  const sourceName = await getNodeName(edge.v);
  const targetName = await getNodeName(edge.w);
  console.log("edge: " + sourceName + " -> " + targetName);
}

export function getId(node: Node): string | undefined {
  if (node) {
    return node._id?.$oid;
  }
  return undefined;

}

export async function setSystemState(systemState: SystemState) {
  systemStateStore.set(systemState);
}

export async function addGlobalVariable(variable_name: string, variable_value: string) {
  const current_state = await getSystemState();
  current_state.graphState.global_variables.set(variable_name, variable_value);
  await setSystemState(current_state);
}

export async function addNode(node_id: string): Promise<void> {
  const systemState = await getSystemState();
  // add the input and output variables to the graph state

  //check if the node already exists in the graph
  if (!systemState.graphState.graph.hasNode(node_id)) {
    systemState.graphState.graph.setNode(node_id);
  }
  systemState.graphState.lastAction = "addNode";
  const node_name = await getNodeName(node_id);
  if (node_name) {
    systemState.graphState.name = node_name;
    systemState.graphState.actedOn = [node_id, node_name];
  } else {
    systemState.graphState.actedOn = [node_id, ""];
  }
  setSystemState(systemState);
}

// function for converting a process to a graph
export async function processToGraph(process: Process): Promise<void> {
  await resetGraph();

  // verify that all of the steps have corresponding actions
  let graph: string | Graph = process.process.graph;

  const nodes: string[] = [];

  // check if the graph is a string and if so, parse it into a graphlib Graph object
  if (typeof graph === "string") {
    const parsed_graph = JSON.parse(graph);
    graph = new Graph(parsed_graph);
  }

  // console.log("nodes: ", nodes);

  // for each of the node ids stored in nodes, get the name of the action

  //loop through the nodes
  for (let i = 0; i < nodes.length; i++) {
    const name = await getNodeName(nodes[i]);
    if (name) {
      await addNode(nodes[i]);
    }
  }

  let edges: Edge[] = [];

  if (graph instanceof Graph) {
    edges = graph.edges();
  }

  let topOrder: string[] = [];

  if (graph instanceof Graph) {
    topOrder = topologicalSort(graph);
  }

  for (const node of topOrder) {
    // filter edges where the source node is the current node
    const nodeEdges = edges.filter(this_edge => this_edge.v === node);

    // iterate over the node's edges and add them
    for (const edge of nodeEdges) {
      // if edge does not exist, add it
      await addEdge(edge); // assuming 'addEdge' is your helper function

    }
  }
}

export async function getParentOutputVariables(this_node_id: string): Promise<string[] | null> {
  const systemState = await getSystemState();

  // get topological order

  const topological_order = systemState.executionContext.topological_order;

  // get parent node id
  const parent_node_id = topological_order[topological_order.indexOf(this_node_id) - 1];

  // get the output variables of the parent node
  const parent_output_variables = getOutputVariablesByNodeId(parent_node_id);

  return parent_output_variables;
}

export async function setLocalExecutionVariable(variable_name: string, variable_value: string): Promise<Map<string, string>> {
  const systemState = await getSystemState();
  systemState.executionContext.local_variables.set(variable_name, variable_value);
  await setSystemState(systemState);
  return systemState.executionContext.local_variables;
}

export async function setGlobalExecutionVariable(variable_name: string, variable_value: string) {
  const systemState = await getSystemState();
  systemState.executionContext.global_variables.set(variable_name, variable_value);
  await setSystemState(systemState);
}

export function addVariablesToPrompt(prompt: string, variables: Map<string, string>): string {
  let new_prompt = prompt;
  for (const [key, value] of variables) {
    new_prompt = new_prompt.replace(key, value);
  }
  return new_prompt;
}

export async function incrementCurrentNode(): Promise<string> {
  const systemState = await getSystemState();

  // look at the topological order and the current_node and set the next node to be the current node
  const topological_order = systemState.executionContext.topological_order;

  // get the index of the current node
  if (systemState.executionContext.current_node != null) {
    const current_node_index = topological_order.indexOf(systemState.executionContext.current_node);
    if (current_node_index + 1 < topological_order.length) {
      systemState.executionContext.current_node = topological_order[current_node_index + 1];

    }
    else {
      console.error("current node index is out of bounds");
    }
  }
  else {
    console.error("current node is null");
    systemState.executionContext.current_node = topological_order[0];
  }

  await setSystemState(systemState);
  return systemState.executionContext.current_node;
}

export async function sendWebsocketMessage(message: CrudBundle) {
  const systemState = await getSystemState();
  let message_string = JSON.stringify(message);
  systemState.websocket.send(message_string);
}

export async function addEdge(edge: Edge): Promise<void> {

  await printEdge(edge);

  const systemState = await getSystemState();
  // check if the edge already exists
  const edgeExists = systemState.graphState.graph.hasEdge(edge);
  if (!edgeExists) {
    systemState.graphState.graph.setEdge(edge);
  }
  systemState.graphState.lastAction = "addEdge";
  systemState.graphState.actedOn = edge;
  setSystemState(systemState);
}

export async function removeNode(id: string): Promise<void> {
  const name = await getNodeName(id);
  const systemState = await getSystemState();
  systemState.graphState.graph.removeNode(id);
  systemState.graphState.lastAction = "removeNode";
  if (name) {
    systemState.graphState.actedOn = [id, name];
  } else {
    systemState.graphState.actedOn = [id, "unknown"];
  }
  setSystemState(systemState);
}

export async function removeSelectedNode(): Promise<void> {
  const systemState = await getSystemState();
  if (Array.isArray(systemState.graphState.actedOn)) {
    const selected = systemState.graphState.actedOn[0];
    await removeNode(selected);
  }
}

export async function removeSelectedEdge(): Promise<void> {
  const systemState = await getSystemState();
  if (
    !Array.isArray(systemState.graphState.actedOn) &&
    systemState.graphState.lastAction == "selectEdge"
  ) {
    const selected = systemState.graphState.actedOn;
    if (selected != null) {
      await removeEdge(selected.v, selected.w);
    }
  } else {
    // console.log("not removing edge, doesn't meet criteria");
  }
}

export async function removeEdge(
  _sourceId: string,
  _targetId: string
): Promise<void> {
  const systemState = await getSystemState();
  // find the id of the edge to remove

  // console.log("removing edge:", sourceId, targetId, " from graph");

  const edge = systemState.graphState.actedOn;
  // graphState.graph.removeEdge(edge);

  systemState.graphState.lastAction = "removeEdge";
  systemState.graphState.actedOn = edge;
  systemState.graphState.name = null;
  setSystemState(systemState);
}

export async function returnProcesses(): Promise<Node[]> {
  const systemState = await getSystemState();
  let nodes = systemState.nodes;

  // filter out the prompts
  nodes = nodes.filter((node: Node) => {
    return node.type_name == "Process";
  }
  );

  // let processes = nodes.map((node: Node) => {
  //   return node.node_content as Process;
  // }
  // );

  return nodes;
}

export async function selectNode(id: string): Promise<void> {
  const system_state = await getSystemState();
  const nodes = system_state.nodes;

  // const res = actions.find((action: Prompt) => {
  //   return getId(action) == id;
  // });

  const res = nodes.find((node: Node) => getId(node) == id);

  if (res) {
    const systemState = await getSystemState();
    systemState.selectedNode = some(res);
    systemState.graphState.lastAction = "selectNode";
    systemState.graphState.lastActedOn = systemState.graphState.actedOn;
    systemState.graphState.actedOn = [id, res.name];
    systemState.graphState.name = res.name;
    setSystemState(systemState);
  }
}

export async function selectEdge(
  source: string,
  target: string
): Promise<void> {
  const systemState = await getSystemState();

  systemState.graphState.lastAction = "selectEdge";
  systemState.graphState.actedOn = { v: source, w: target };
  systemState.graphState.name = null;
  setSystemState(systemState);
}

export async function resetLastAction(): Promise<void> {
  const systemState = await getSystemState();
  systemState.graphState.lastAction = "none";
  systemState.graphState.actedOn = null;
  setSystemState(systemState);
}

export async function nodes(): Promise<string[]> {
  const systemState = await getSystemState();
  return systemState.graphState.graph.nodes();
}

export async function edges(): Promise<Edge[]> {
  const systemState = await getSystemState();
  return systemState.graphState.graph.edges();
}

// reset the graphState to a new empty graph
export async function resetGraph(): Promise<void> {
  // console.log("resetting graph");
  const systemState = await getSystemState();
  systemState.graphState.graph = new Graph();
  systemState.graphState.lastAction = "resetGraph";
  systemState.graphState.actedOn = null;
  systemState.graphState.name = null;
  setSystemState(systemState);
}
