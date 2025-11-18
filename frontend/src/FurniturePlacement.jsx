import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Select,
  Input,
  Button,
  Typography,
  Card,
  Row,
  Col,
  Spin,
  Empty,
  Tooltip,
} from "antd";

const { Title, Text } = Typography;
const { Option } = Select;

function FurniturePlacement({ isDarkMode }) {
  const didFetch = useRef(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [designs, setDesigns] = useState([]);
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [selectedDesignImage, setSelectedDesignImage] = useState(null);
  const [furnitureImage, setFurnitureImage] = useState(null);
  const [furniturePreview, setFurniturePreview] = useState(null);
  const [furnitureDescription, setFurnitureDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [result, setResult] = useState(null);
  const [library, setLibrary] = useState([]);

  const textColor = isDarkMode ? "#e4e4e4" : "#111827";
  const bgColor = isDarkMode ? "#1f1f1f" : "#ffffff";
  const borderColor = isDarkMode ? "#333" : "#d9d9d9";
  const fetchLibrary = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/furniture/all", {
        params: { session_id: "furniture-test" }
      });
      setLibrary(res.data.furnitures || []);
    } catch (err) {
      console.error("Failed to load furniture library", err);
      toast.error("Failed to load furniture library");
    }
  };

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    const init = async () => {
      await fetchAllDesigns();
      await fetchLibrary();
    };
    init();
  }, []);

  const fetchAllDesigns = async () => {
    setLoadingDesigns(true);
    try {
      const response = await axios.get(
        "http://127.0.0.1:8000/api/designs/all"
      );
      setDesigns(response.data.designs || []);
      if ((!response.data.designs || response.data.designs.length === 0)) {
        toast.info("No room designs available yet. Generate a design first.");
      }
    } catch (error) {
      console.error("Error fetching designs:", error);
      toast.error("Failed to fetch room designs");
    } finally {
      setLoadingDesigns(false);
    }
  };

  const [pendingUploadFile, setPendingUploadFile] = useState(null);

  const handleFurnitureSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Upload an image");
      return;
    }

    setPendingUploadFile(file); // store for uploading later
    setFurniturePreview(URL.createObjectURL(file)); // preview only
    setFurnitureImage(null); // clear previous selection
  };

  const handleUploadToLibrary = async () => {
    if (!pendingUploadFile) {
      toast.error("No file selected to upload");
      return;
    }

    const form = new FormData();
    form.append("session_id", "furniture-test");
    form.append("name", pendingUploadFile.name);
    form.append("furniture_image", pendingUploadFile);

    try {
      await axios.post("http://127.0.0.1:8000/api/furniture/upload", form);
      toast.success("Added to furniture library");
      setFurnitureImage(pendingUploadFile); // now mark as selected
      setPendingUploadFile(null); // clear pending state
      setFurniturePreview(null); // ✅ clear preview
      fetchLibrary(); // refresh library
      setFileInputKey(Date.now());
    } catch (err) {
      toast.error("Upload failed");
    }
  };

  const handleDesignSelection = async (designId) => {
    setSelectedDesignId(designId);
    setSelectedDesignImage(null);

    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/design/${designId}/image`
      );
      setSelectedDesignImage(response.data.image);
    } catch (error) {
      console.error("Error fetching design image:", error);
      toast.error("Failed to load design image");
    }
  };




  const handlePlaceFurniture = async (e) => {
    e.preventDefault();

    if (!selectedDesignId) {
      toast.error("Please select a room design");
      return;
    }

    if (!furnitureImage) {
      toast.error("Please upload a furniture image");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("design_id", selectedDesignId);
    formData.append("session_id", "furniture-test");
    if (furnitureImage?.id) {
      formData.append("furniture_id", furnitureImage.id);
    } else {
      formData.append("furniture_image", furnitureImage);
    }
    formData.append("furniture_description", furnitureDescription);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/place-furniture",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult({
        image: response.data.image,
        text: response.data.text,
        timestamp: new Date().toLocaleString(),
      });

      toast.success("Furniture placed successfully!");
    } catch (error) {
      console.error("Error placing furniture:", error);
      toast.error("Failed to place furniture");
    } finally {
      setLoading(false);
    }
  };

  const getDesignLabel = (design) => {
    const roomType = design.metadata?.room_type || "Room";
    const style = design.metadata?.style || "Design";
    const date = new Date(design.created_at).toLocaleDateString();
    return `${roomType} - ${style} (${date})`;
  };

  const handleClearFurniture = () => {
    setFurnitureImage(null);
    setFurniturePreview(null);
    setFurnitureDescription("");
  };

  const handleNewTest = () => {
    setSelectedDesignId(null);
    setSelectedDesignImage(null);
    setFurnitureImage(null);
    setFurniturePreview(null);
    setFurnitureDescription("");
    setResult(null);
  };

  return (
    <div style={{ padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Title level={2} style={{ color: textColor, textAlign: "center" }}>
          Furniture Placement Tool
        </Title>
        <Text
          style={{
            color: textColor,
            display: "block",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          Select any room design and place your own furniture into it
        </Text>

        {!result ? (
          <form onSubmit={handlePlaceFurniture}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card
                  title="Step 1: Select Room Design"
                  style={{
                    background: bgColor,
                    borderColor: borderColor,
                    height: "100%",
                  }}
                  styles={{ header: { color: textColor } }}
                >
                  {loadingDesigns ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <Spin size="large" />
                      <Text style={{ display: "block", marginTop: 16, color: textColor }}>
                        Loading room designs...
                      </Text>
                    </div>
                  ) : designs.length === 0 ? (
                    <Empty description="No room designs found">
                      <Text style={{ color: textColor }}>
                        Generate a room design on the first tab to get started
                      </Text>
                    </Empty>
                  ) : (
                    <>
                      <Text style={{ color: textColor }}>
                        Choose from available room designs
                      </Text>
                      <Select
                        placeholder="Select a room design"
                        style={{ width: "100%", marginTop: 8, marginBottom: 16 }}
                        value={selectedDesignId}
                        onChange={handleDesignSelection}
                        optionLabelProp="label"
                      >
                        {designs.map((design) => (
                          <Option
                            key={design.id}
                            value={design.id}
                            label={
                              <Tooltip title={getDesignLabel(design)}>
                                <div>{getDesignLabel(design)}</div>
                              </Tooltip>
                            }
                          >
                            {getDesignLabel(design)}
                          </Option>
                        ))}
                      </Select>

                      {selectedDesignImage && (
                        <div style={{ marginTop: 16 }}>
                          <img
                            src={selectedDesignImage}
                            alt="Selected Room"
                            style={{
                              width: "100%",
                              borderRadius: 12,
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </Col>

              <Card title="Your Furniture Library">
                {library.length === 0 ? (
                  <Text>No furniture uploaded yet</Text>
                ) : (
                  <Row gutter={[16, 16]}>
                    {library.map(item => (
                      <Col xs={12} md={6} key={item.id}>
                        <Card
                          hoverable
                          onClick={() => {
                            setFurniturePreview(item.image);
                            setFurnitureImage(item); // Use library item instead of file object
                          }}
                          extra={
                            <Button
                              type="text"
                              danger
                              onClick={async (e) => {
                                e.stopPropagation(); // prevent selecting the furniture
                                try {
                                  await axios.delete(`http://127.0.0.1:8000/api/furniture/${item.id}`);
                                  toast.success("Furniture deleted");
                                  fetchLibrary();
                                  if (furnitureImage?.id === item.id) handleClearFurniture();
                                } catch (err) {
                                  toast.error("Failed to delete furniture");
                                }
                              }}
                            >
                              Delete
                            </Button>
                          }
                        >
                          <img src={item.image} style={{ width: "100%", borderRadius: 8 }} />
                          <Text>{item.description || "Furniture"}</Text>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </Card>


              <Col xs={24} md={12}>
                <Card
                  title="Step 2: Upload Furniture"
                  
                  style={{
                    background: bgColor,
                    borderColor: borderColor,
                    height: "100%",
                  }}
                  styles={{ header: { color: textColor } }}
                >
                  <Text style={{ color: textColor }}>
                    Upload an image of furniture or object
                  </Text>
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    onChange={handleFurnitureSelect}
                    style={{ marginTop: 8, marginBottom: 16 }}
                  />

                  {pendingUploadFile && (
                    <Button
                      type="primary"
                      onClick={handleUploadToLibrary}
                      style={{ marginBottom: 16 }}
                    >
                      Upload to Library
                    </Button>
                  )}

                  {furniturePreview && (
                    <div style={{ marginTop: 16, marginBottom: 16 }}>
                      <img
                        src={furniturePreview}
                        alt="Furniture Preview"
                        style={{
                          width: "100%",
                          maxHeight: "300px",
                          objectFit: "contain",
                          borderRadius: 12,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Button
                        type="link"
                        danger
                        onClick={handleClearFurniture}
                        style={{ marginTop: 12 }}
                      >
                        Clear Image
                      </Button>
                    </div>
                  )}

                  <Text style={{ color: textColor }}>
                    Describe the furniture (optional)
                  </Text>
                  <Input.TextArea
                    rows={3}
                    value={furnitureDescription}
                    onChange={(e) => setFurnitureDescription(e.target.value)}
                    style={{ width: "100%", marginTop: 8 }}
                    placeholder="e.g., Modern gray sofa, Wooden dining table, Floor lamp..."
                  />
                </Card>
              </Col>
            </Row>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                style={{ width: 200, height: 48 }}
                disabled={!furnitureImage}
              >
                {loading ? "Placing..." : "Place Furniture"}
              </Button>
            </div>
          </form>
        ) : (
          <Row gutter={24} justify="center">
            <Col xs={24} lg={16}>
              <Card
                style={{
                  background: bgColor,
                  borderColor: borderColor,
                }}
              >
                <img
                  src={result.image}
                  alt="Furniture Placement Result"
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                  }}
                />
                {result.text && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      background: isDarkMode ? "#2a2a2a" : "#f9fafb",
                      borderRadius: 8,
                      color: textColor,
                    }}
                  >
                    <Text style={{ color: textColor }}>{result.text}</Text>
                  </div>
                )}
                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: isDarkMode ? "#a1a1aa" : "#666",
                      fontSize: 12,
                    }}
                  >
                    {result.timestamp}
                  </Text>
                  <Button
                    type="primary"
                    onClick={handleNewTest}
                  >
                    Test Another Furniture
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </div>
      <ToastContainer theme={isDarkMode ? "dark" : "light"} />
    </div>
  );
}

export default FurniturePlacement;