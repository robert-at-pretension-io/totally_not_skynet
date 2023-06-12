use crate::domain::{ MessageTypes, NodeType, Response};
use crate::mongo::{get_nodes, return_db};
use crate::openai::{get_openai_completion, ChatMessage, Role};
use crate::settings::{RuntimeSettings, UserSettings};
use crate::utils::parse_message;

use bollard::container::Config;
use bollard::exec::{CreateExecOptions, StartExecResults};
use bollard::Docker;
use bson::{doc};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tokio::sync::mpsc;
use tokio::sync::mpsc::UnboundedSender;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Identity {
    pub name: String,
}

impl Identity {
    pub fn new(name: String) -> Identity {
        Identity { name }
    }
}

pub async fn start_message_sending_loop(
    // docker: Docker,
    tx: UnboundedSender<(Identity, Message)>,
    mut client_rx: mpsc::Receiver<(Identity, String)>,
) {
    let mut runtime_settings: HashMap<Identity, RuntimeSettings> = HashMap::new();
    let mut messages_thus_far: HashMap<Identity, Vec<String>> = HashMap::new();
    let mut docker_containers: HashMap<Identity, String> = HashMap::new();

    // startup the docker container here
    let docker = Docker::connect_with_local_defaults().unwrap();

    //read messages from the client
    while let Some(msg) = client_rx.recv().await {
        println!("Received a message from the client: {}", msg.1);

        let received_message: Option<MessageTypes> = parse_message(&msg.1);

        let message_contents: MessageTypes;

        if received_message.is_none() {
            print!("Received an invalid message from the client: {}", msg.1);
            continue;
        } else {
            message_contents = received_message.unwrap();
            println!(
                "Received a parsed message from the client: {:?}",
                message_contents
            );
        }

        match message_contents {
            MessageTypes::InitializeProject(_) => {
                // get the actions and processes from the db

                // send the actions to the client

                let db_uri = runtime_settings.get(&msg.0).unwrap().mongo_db_uri.clone();

                let db = return_db(db_uri).await;

                // let (my_action, my_processes) = get_actions_and_processes(&db).await;

                let nodes = get_nodes(&db).await;

                // create nodes from the actions and processes

                // for action in &my_actions.clone() {
                //     send_message(&tx, msg.0, &action).await;
                // }

                // for process in &my_processes.clone() {
                //     send_message(&tx, msg.0, &process).await;
                // }

                for node in &nodes {
                    send_message(&tx, msg.0.clone(), &node).await;
                }

                const IMAGE: &str = "alpine:3";

                let alpine_config = Config {
                    image: Some(IMAGE),
                    tty: Some(true),
                    attach_stdin: Some(true),
                    attach_stdout: Some(true),
                    attach_stderr: Some(true),
                    open_stdin: Some(true),
                    ..Default::default()
                };

                let id = docker
                    .create_container::<&str, &str>(None, alpine_config.clone())
                    .await
                    .unwrap()
                    .id;

                println!("Created container with id: {}", id);
                docker_containers.insert(msg.0.clone(), id);
                //     docker_containers.push((msg.0, id));
            }
            MessageTypes::SetUserSettings(settings) => {
                println!("Setting openai key for {}", msg.0.name);

                // attempt to set them from environment variables
                let user_settings = UserSettings::new();

                if user_settings.is_some() {
                    let user_settings = user_settings.unwrap();
                    runtime_settings.insert(
                        msg.0.clone(),
                        RuntimeSettings {
                            openai_api_key: user_settings.openai_api_key,
                            mongo_db_uri: user_settings.mongo_db_uri,
                        },
                    );
                } else {
                    runtime_settings.insert(
                        msg.0.clone(),
                        RuntimeSettings {
                            openai_api_key: settings.openai_api_key,
                            mongo_db_uri: settings.mongo_db_uri,
                        },
                    );
                }

                // respond to the client
                match tx.send((
                    Identity::new(msg.0.name.to_string()),
                    Message::Text("Settings received".to_string()),
                )) {
                    Ok(_) => {}
                    Err(e) => {
                        println!("Error sending message to client: {:?}", e);
                        break;
                    }
                }
            }

            // MessageTypes::UpdateAction(update_action) => {
            //     let updated_action = update_action.action;

            //     let db_uri = runtime_settings.get(&msg.0).unwrap().mongo_db_uri.clone();

            //     let db = return_db(db_uri).await;

            //     let action_collection = db.collection::<Node>("nodes");

            //     let filter = doc! { "_id": updated_action._id.clone().unwrap() };

            //     let update = doc! { "$set": { "name": updated_action.name.clone(), "prompt":

            //         updated_action.prompt.clone(),  "system" : updated_action.system.clone(), "input_variables" : updated_action.input_variables.clone(), "output_variables": updated_action.output_variables.clone() }
            //     };

            //     let update_result = action_collection
            //         .update_one(filter, update, None)
            //         .await
            //         .unwrap();

            //     if update_result.modified_count == 0 {
            //         println!("No actions updated");
            //     } else {
            //         println!("Updated {} actions", update_result.modified_count);

            //         match tx.send((
            //             Identity::new(msg.0.name.to_string()),
            //             Message::Text(json!(updated_action).to_string()),
            //         )) {
            //             Ok(_) => {}
            //             Err(e) => {
            //                 println!("Error sending message to client: {:?}", e);
            //                 break;
            //             }
            //         }
            //     }
            // }
            // MessageTypes::CreateAction(create_action) => {
            //     let db_uri = runtime_settings.get(&msg.0).unwrap().mongo_db_uri.clone();

            //     let db = return_db(db_uri).await;

            //     let action_collection = db.collection::<Prompt>("actions");

            //     let mut action = create_action.create_action.clone();

            //     action._id = Some(bson::oid::ObjectId::new());

            //     let insert_result = action_collection.insert_one(action, None).await.unwrap();

            //     println!("Inserted action: {}", insert_result.inserted_id);

            //     let inserted_action = action_collection
            //         .find_one(doc! { "_id": insert_result.inserted_id.clone() }, None)
            //         .await
            //         .unwrap()
            //         .unwrap();

            //     // send the created action back to the client
            //     let created_action: Prompt = inserted_action;

            //     let response = CreateAction {
            //         create_action: created_action,
            //     };

            //     match tx.send((
            //         Identity::new(msg.0.name.to_string()),
            //         Message::Text(json!(response).to_string()),
            //     )) {
            //         Ok(_) => {}
            //         Err(e) => {
            //             println!("Error sending message to client: {:?}", e);
            //             break;
            //         }
            //     }
            // }
            // MessageTypes::CreateProcess(create_process) => {
            //     let db_uri = runtime_settings.get(&msg.0).unwrap().mongo_db_uri.clone();

            //     let db = return_db(db_uri).await;

            //     let process_collection = db.collection::<Process>("processes");

            //     let mut process = create_process.create_process.clone();

            //     process._id = Some(bson::oid::ObjectId::new());

            //     let insert_result = process_collection.insert_one(process, None).await.unwrap();

            //     println!("Inserted process: {}", insert_result.inserted_id);

            //     let inserted_process = process_collection
            //         .find_one(doc! { "_id": insert_result.inserted_id.clone() }, None)
            //         .await
            //         .unwrap()
            //         .unwrap();

            //     // send the created process back to the client
            //     let created_process: Process = inserted_process;

            //     let response = CreateProcess {
            //         create_process: created_process,
            //     };

            //     match tx.send((
            //         Identity::new(msg.0.name.to_string()),
            //         Message::Text(json!(response).to_string()),
            //     )) {
            //         Ok(_) => {}
            //         Err(e) => {
            //             println!("Error sending message to client: {:?}", e);
            //             break;
            //         }
            //     }
            // }

            MessageTypes::HandleNode(node) => {
                match node.node_content {
                    NodeType::Prompt(prompt) => {
                        let openai_api_key = match runtime_settings.get(&msg.0) {
                            Some(settings) => Some(settings.openai_api_key.clone()),
                            None => {
                                println!("No openai key set for {}", msg.0.name);
                                None
                            }
                        };

                        if openai_api_key.is_some() {
                            let messages = vec![
                                ChatMessage {
                                    role: Role::System,
                                    content: prompt.system.unwrap_or(''.to_string()).clone(),
                                },
                                ChatMessage {
                                    role: Role::User,
                                    content: prompt.prompt.clone(),
                                },
                            ];

                            let response =
                                get_openai_completion(messages, openai_api_key.unwrap()).await;

                            match response {
                                Ok(res) => {
                                    let rez = Response {
                                        action_id: node._id.clone().unwrap().to_string(),
                                        response_text: res,
                                    };
                                    match tx.send((
                                        Identity::new(msg.0.name.to_string()),
                                        Message::Text(json!(rez).to_string()),
                                    )) {
                                        Ok(_) => {}
                                        Err(e) => {
                                            println!("Error sending message to client: {:?}", e);
                                            break;
                                        }
                                    }
                                }
                                Err(_) => todo!(),
                            }
                        }
                    }
                    NodeType::Conditional(conditional) => {}
                    NodeType::Command(command) => {
                        if let Some(container_id) = docker_containers.get(&msg.0) {
                            let exec_options = CreateExecOptions {
                                attach_stdout: Some(true),
                                cmd: Some(vec!["sh", "-c", &command.command]),
                                ..Default::default()
                            };

                            let exec_created = docker
                                .create_exec(container_id, exec_options)
                                .await
                                .unwrap();

                            // Start the exec instance
                            let exec_started =
                                docker.start_exec(&exec_created.id, None).await.unwrap();

                            match exec_started {
                                StartExecResults::Attached { mut output, .. } => {
                                    let mut full_output = String::new(); // used to accumulate the output

                                    while let Some(item) = output.next().await {
                                        match item {
                                            Ok(log) => {
                                                println!("{:?}", log);
                                                let log_str = log.to_string();
                                                full_output.push_str(&log_str);
                                                full_output.push('\n'); // add a newline between each piece of output
                                            }
                                            Err(e) => eprintln!("Error: {:?}", e),
                                        }
                                    }

                                    // Once we've read all the output, send it to the client

                                    send_message(&tx, msg.0.clone(), full_output).await;
                                }
                                StartExecResults::Detached => {
                                    println!("The exec instance completed execution and detached");
                                }
                            }
                        } else {
                            println!("No container found for this client.");
                        }
                    }
                    NodeType::Process(_) => todo!(),
                }
            }
            MessageTypes::UpdateNode(_) => todo!(),
            MessageTypes::CreateNode(create_node) => {
                    let db_uri = runtime_settings.get(&msg.0).unwrap().mongo_db_uri.clone();
    
                    let db = return_db(db_uri).await;
    
                    let action_collection = db.collection::<crate::domain::Node>("nodes");
    
                    let mut node = create_node.node.clone();
    
                    node._id = Some(bson::oid::ObjectId::new());
    
                //     let insert_result = action_collection.insert_one(action, None).await.unwrap();
    
                //     println!("Inserted action: {}", insert_result.inserted_id);
    
                //     let inserted_action = action_collection
                //         .find_one(doc! { "_id": insert_result.inserted_id.clone() }, None)
                //         .await
                //         .unwrap()
                //         .unwrap();
    
                //     // send the created action back to the client
                //     let created_action: Prompt = inserted_action;
    
                //     let response = CreateAction {
                //         create_action: created_action,
                //     };
    
                //     match tx.send((
                //         Identity::new(msg.0.name.to_string()),
                //         Message::Text(json!(response).to_string()),
                //     )) {
                //         Ok(_) => {}
                //         Err(e) => {
                //             println!("Error sending message to client: {:?}", e);
                //             break;
                //         }
                //     }
                // }
            }
        }
    }
}

pub async fn send_message<T: Serialize + Sized>(
    tx: &UnboundedSender<(Identity, Message)>,
    identity: Identity,
    message: T,
) {
    match tx.send((identity, Message::Text(json!(message).to_string()))) {
        Ok(_) => {}
        Err(e) => {
            println!("Error sending message to client: {:?}", e);
        }
    }
}
