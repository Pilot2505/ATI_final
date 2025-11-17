import { useState, useEffect } from "react";
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
  Divider,
  Spin,
} from "antd";

const { Title, Text } = Typography;
const { Option } = Select;

function FurniturePlacement({ sessionId, isDarkMode }) {
  const [designs, setDesigns] = useState([]);
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [selectedDesignImage, setSelectedDesignImage] = useState(null);
  const [furnitureImage, setFurnitureImage] = useState(null);
  const [furniturePreview, setFurniturePreview] = useState(null);
  const [furnitureDescription, setFurnitureDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [result, setResult] = useState(null);

  const textColor = isDarkMode ? "#e4e4e4" : "#111827";
  const bgColor = isDarkMode ? "#1f1f1f" : "#ffffff";
  const borderColor = isDarkMode ? "#333" : "#d9d9d9";

  useEffect(() => {
    if (sessionId) {
      fetchDesigns();
    }
  }, [sessionId]);

  const fetchDesigns = async () => {
    setLoadingDesigns(true);
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/designs/${sessionId}`
      );
      setDesigns(response.data.designs || []);
      if (response.data.designs.length === 0) {
        toast.info("No designs found. Please generate a room design first.");
      }
    } catch (error) {
      console.error("Error fetching designs:", error);
      toast.error("Failed to fetch designs");
    } finally {
      setLoadingDesigns(false);
    }
  };

  const handleDesignSelection = async (designId) => {
    setSelectedDesignId(designId);
    setSelectedDesignImage(null);

    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/designs/${sessionId}/${designId}/image`
      );
      setSelectedDesignImage(response.data.image);
    } catch (error) {
      console.error("Error fetching design image:", error);
      toast.error("Failed to load design image");
    }
  };

  const handleFurnitureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be smaller than 10MB");
        return;
      }

      setFurnitureImage(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setFurniturePreview(reader.result);
      };
      reader.readAsDataURL(file);
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
    formData.append("session_id", sessionId);
    formData.append("furniture_image", furnitureImage);
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
          Select a room design and add your own furniture
        </Text>

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
                headStyle={{ color: textColor }}
              >
                {loadingDesigns ? (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <>
                    <Text style={{ color: textColor }}>
                      Choose from your generated designs
                    </Text>
                    <Select
                      placeholder="Select a room design"
                      style={{ width: "100%", marginTop: 8, marginBottom: 16 }}
                      value={selectedDesignId}
                      onChange={handleDesignSelection}
                    >
                      {designs.map((design) => (
                        <Option key={design.id} value={design.id}>
                          {design.metadata?.room_type || "Room"} -{" "}
                          {design.metadata?.style || "Design"} (
                          {new Date(design.created_at).toLocaleDateString()})
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

            <Col xs={24} md={12}>
              <Card
                title="Step 2: Upload Furniture"
                style={{
                  background: bgColor,
                  borderColor: borderColor,
                  height: "100%",
                }}
                headStyle={{ color: textColor }}
              >
                <Text style={{ color: textColor }}>
                  Upload an image of furniture or object
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFurnitureUpload}
                  style={{ marginTop: 8, marginBottom: 16 }}
                />

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
              disabled={!selectedDesignId || !furnitureImage}
            >
              {loading ? "Placing..." : "Place Furniture"}
            </Button>
          </div>
        </form>

        {result && (
          <div style={{ marginTop: 64 }}>
            <Divider />
            <Title level={3} style={{ color: textColor, textAlign: "center" }}>
              Result
            </Title>
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
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <Text
                      style={{
                        color: isDarkMode ? "#a1a1aa" : "#666",
                        fontSize: 12,
                      }}
                    >
                      {result.timestamp}
                    </Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </div>
      <ToastContainer theme={isDarkMode ? "dark" : "light"} />
    </div>
  );
}

export default FurniturePlacement;
